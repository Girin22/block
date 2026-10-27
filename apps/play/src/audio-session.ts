/**
 * The game's audio alongside other apps' (2026-10-27).
 * - With the environment off, the game's sound mixes with music from another app (YouTube Music and
 *   the like) instead of stopping it: WebKit's audio session 'ambient' (iOS 17+). Android's WebView
 *   takes the audio focus only for playing media elements, which the off environment never starts.
 *   'ambient' also follows the iPhone's silent switch, so effects go quiet there in silent mode.
 * - Coming back after another app has taken the audio, iOS can leave a context 'interrupted' for good,
 *   and resume() never completes. Such a context is replaced.
 */
type SessionType = 'auto' | 'ambient';
export function mixWithOtherAudio(mix: boolean) {
  const session = (navigator as Navigator & { audioSession?: { type: SessionType } }).audioSession;
  try { if (session) session.type = mix ? 'ambient' : 'auto'; } catch { /* Older WebKit: the default session stays. */ }
}

/** The app shell's bridge, read from its global so the sound modules stay free of Capacitor (their tests run in Node). */
const nativeApp = () => Boolean((globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
/** Milliseconds a resume() may take before the context counts as stuck. */
const STUCK_MS = 700;
/**
 * Runs `replace` if `context` has not come back shortly after a resume(): 'interrupted' anywhere, or
 * 'suspended' in the app shell (where a fresh context may start without a tap; a browser would only
 * leave a fresh one suspended as well).
 */
export function replaceIfStuck(context: AudioContext, replace: () => void) {
  window.setTimeout(() => {
    const state = context.state as string;
    if (state === 'interrupted' || (nativeApp() && state === 'suspended')) replace();
  }, STUCK_MS);
}
