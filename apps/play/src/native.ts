import { Capacitor } from '@capacitor/core';

/**
 * The thin layer between the game and the app shell (Capacitor). On the web every call here is a
 * no-op or falls back to the browser, so the web build behaves exactly as before.
 */
export const isNativeApp = Capacitor.isNativePlatform();

export interface NativeHooks {
  /** The Android back button. Return true when the game used it; false lets the app go to the background. */
  back: () => boolean;
  /** The app left the screen (home button, app switcher, lock). */
  hidden: () => void;
  /** The app is on screen again. */
  shown: () => void;
}

/** Wires the shell's lifecycle and system UI. Plugins load only inside the app. */
export async function installNative(hooks: NativeHooks) {
  if (!isNativeApp) return;
  const [{ App }, { StatusBar }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar')]);
  // Full-screen play: no clock or battery row over the board (iOS hides it from Info.plist already).
  if (Capacitor.getPlatform() === 'android') void StatusBar.hide().catch(() => {});
  void App.addListener('backButton', () => { if (!hooks.back()) void App.minimizeApp(); });
  // WebViews do not always report page visibility when the whole app is backgrounded, so the shell's
  // own state is the source of truth here.
  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) hooks.shown(); else hooks.hidden(); });
}

/** Base64 of a blob slice; the slice size is a multiple of 3, so pieces join into one valid file. */
function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Writes a file into the app's cache a few MB at a time, so a very long pavement never needs one huge string. */
async function cacheFile(file: File) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const path = `export/${file.name}`, chunk = 3 * 1024 * 1024;
  // Earlier exports are cleared here rather than right after sharing: the app receiving a shared file
  // may read it only after the share sheet has closed.
  await Filesystem.rmdir({ path: 'export', directory: Directory.Cache, recursive: true }).catch(() => {});
  for (let start = 0; start < file.size || start === 0; start += chunk) {
    const data = await base64(file.slice(start, start + chunk));
    if (start === 0) await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
    else await Filesystem.appendFile({ path, data, directory: Directory.Cache });
    if (file.size === 0) break;
  }
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return uri;
}

const ALBUM = '보도보도';

/** Android saves into an album the app owns; it is created the first time. iOS saves to the camera roll. */
async function albumIdentifier() {
  if (Capacitor.getPlatform() !== 'android') return undefined;
  const { Media } = await import('@capacitor-community/media');
  const find = async () => (await Media.getAlbums()).albums.find(album => album.name === ALBUM)?.identifier;
  const existing = await find();
  if (existing) return existing;
  await Media.createAlbum({ name: ALBUM });
  return find();
}

/**
 * Saves an exported pavement where a player looks for it: a PNG goes into the photo library, an SVG
 * (too large for a photo) goes to the share sheet so it can be kept in Files. Returns what happened,
 * for the status line. Throws when saving failed; a cancelled share returns 'cancelled'.
 */
export async function saveExport(file: File): Promise<'photo' | 'shared' | 'cancelled'> {
  const uri = await cacheFile(file);
  if (file.type === 'image/png') {
    const { Media } = await import('@capacitor-community/media');
    await Media.savePhoto({ path: uri, albumIdentifier: await albumIdentifier(), fileName: file.name.replace(/\.png$/, '') });
    return 'photo';
  }
  const { Share } = await import('@capacitor/share');
  try { await Share.share({ title: file.name, files: [uri] }); }
  catch (error) { if (/cancel/i.test(String(error))) return 'cancelled'; throw error; }
  return 'shared';
}
