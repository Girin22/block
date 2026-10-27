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
 * How the game's sound shares the phone with other apps (2026-10-27). With the environment off (X) the
 * session plays alongside another app's music (YouTube Music) and is made active again each time the app
 * returns, since WebKit left it silent after that music had played. Otherwise it is an ordinary playback
 * session, which takes over from other music. Both play through the silent switch, as the app always has.
 */
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setMix", returnType: CAPPluginReturnPromise)]
    private var mix = false

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(apply), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc func setMix(_ call: CAPPluginCall) {
        mix = call.getBool("mix") ?? false
        apply()
        call.resolve()
    }

    @objc private func apply() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: mix ? [.mixWithOthers] : [])
        // A mixing session never stops the other music, so it can be made active right away.
        if mix { try? session.setActive(true) }
    }
}
