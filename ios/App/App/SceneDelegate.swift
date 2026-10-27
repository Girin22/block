import AVFoundation
import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = BridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/** The game's bridge, with the app's own plugins registered. */
class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AudioSessionPlugin())
    }
}

/**
 * How the game's sound shares the phone with other apps (2026-10-27).
 * With the environment off (X) the page plays no audio of its own: WebKit took the session over from
 * any category set here, and its mixing 'ambient' mode went silent for good once YouTube Music had
 * played. Instead this plugin plays the block and pause sounds itself, on a playback session that mixes
 * with other music and is made active again whenever the app returns or an interruption ends. Other
 * environments leave the session to WebKit, which takes over from other music as before.
 */
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setMix", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "load", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
    ]
    /** Every call runs here in order, so a sound never plays before its session or its buffer is ready. */
    private let queue = DispatchQueue(label: "com.simulien.bodobodo.audio")
    private let engine = AVAudioEngine()
    private var mix = false
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    /** A few voices per channel count (the pops are mono, the stones stereo), each with its own speed. */
    private var voices: [AVAudioChannelCount: [(player: AVAudioPlayerNode, speed: AVAudioUnitVarispeed)]] = [:]
    private var turn = 0

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(refresh), name: UIApplication.didBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(refresh), name: AVAudioSession.interruptionNotification, object: nil)
    }

    @objc func setMix(_ call: CAPPluginCall) {
        let value = call.getBool("mix") ?? false
        queue.async {
            self.mix = value
            if value { self.activate() } else { self.engine.stop() }
            call.resolve()
        }
    }

    /** Reads each sound once from the web build inside the app (`path` is its address on the page). */
    @objc func load(_ call: CAPPluginCall) {
        let sounds = call.getArray("sounds", JSObject.self) ?? []
        queue.async {
            guard let root = Bundle.main.resourceURL?.appendingPathComponent("public") else { call.reject("no web build"); return }
            for sound in sounds {
                guard let id = sound["id"] as? String, let path = sound["path"] as? String else { continue }
                let url = root.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
                guard let file = try? AVAudioFile(forReading: url),
                      let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
                      (try? file.read(into: buffer)) != nil else { continue }
                self.buffers[id] = buffer
                self.prepareVoices(for: buffer.format)
            }
            call.resolve()
        }
    }

    /** `rate` changes speed and pitch together, as the page's playbackRate does; `delay` is in seconds. */
    @objc func play(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? "", rate = Float(call.getDouble("rate") ?? 1)
        let volume = Float(call.getDouble("volume") ?? 1), delay = call.getDouble("delay") ?? 0
        queue.async {
            defer { call.resolve() }
            guard self.mix, let buffer = self.buffers[id], let pool = self.voices[buffer.format.channelCount], !pool.isEmpty else { return }
            if !self.engine.isRunning { self.activate() }
            guard self.engine.isRunning else { return }
            self.turn += 1
            let voice = pool[self.turn % pool.count]
            voice.player.stop()
            voice.speed.rate = rate; voice.player.volume = volume
            voice.player.scheduleBuffer(buffer, completionHandler: nil)
            if delay > 0 { voice.player.play(at: AVAudioTime(hostTime: mach_absolute_time() + AVAudioTime.hostTime(forSeconds: delay))) }
            else { voice.player.play() }
        }
    }

    private func prepareVoices(for format: AVAudioFormat) {
        guard voices[format.channelCount] == nil else { return }
        voices[format.channelCount] = (0..<6).map { _ in
            let player = AVAudioPlayerNode(), speed = AVAudioUnitVarispeed()
            engine.attach(player); engine.attach(speed)
            engine.connect(player, to: speed, format: format)
            engine.connect(speed, to: engine.mainMixerNode, format: format)
            return (player, speed)
        }
    }

    /** A playback session that mixes with other apps (it plays through the silent switch, as the game always has). */
    private func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)
        if !voices.isEmpty && !engine.isRunning { try? engine.start() }
    }

    /** Back in the app, or another app's interruption is over: the mixing session is made active again. */
    @objc private func refresh() {
        queue.async { if self.mix { self.activate() } }
    }
}
