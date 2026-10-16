import type { Receipt } from './export';

/**
 * After an export is saved, a small card with a thumbnail of the picture rises in the bottom-left corner
 * for a few seconds, the way iOS shows a fresh screenshot, so the player knows it went to their photos
 * (2026-10-16; before, a saved photo said nothing). Tapping it opens the photos app where there is one.
 */
export const TOAST_SECONDS = 3.5;
/** Thumbnail size in CSS px; the picture is cropped from its top, where the label and newest rows are. */
const THUMB_WIDTH = 52, THUMB_HEIGHT = 70;
/** Picture px above the pavement that hold only the date line (export.ts draws the first tiles at 76). */
const LABEL_BAND = 60;

/**
 * The thumbnail is drawn from the pavement itself, not by decoding the saved file, which can be tens of
 * megapixels. Only the top of the picture is rendered, at a small scale.
 */
function thumbnail(receipt: Receipt) {
  // The label's blank band is left out; the label itself is too small to read at this size anyway.
  const scale = (THUMB_WIDTH * 2) / (receipt.width - 40), top = Math.min(LABEL_BAND, receipt.height / 2);
  const height = Math.min(receipt.height - top, (THUMB_HEIGHT * 2) / scale);
  return URL.createObjectURL(new Blob([receipt.window(top, height, scale, false)], { type: 'image/svg+xml' }));
}

let current: { root: HTMLElement; url: string; timer: number } | undefined;

function dismiss() {
  if (!current) return;
  const { root, url, timer } = current; current = undefined;
  clearTimeout(timer); root.classList.remove('shown');
  window.setTimeout(() => { root.remove(); URL.revokeObjectURL(url); }, 400);
}

export function showSavedToast(parent: HTMLElement, receipt: Receipt, message: string, open?: () => void) {
  dismiss();
  const url = thumbnail(receipt);
  const root = document.createElement(open ? 'button' : 'div'); root.id = 'saved-toast';
  root.setAttribute('role', 'status');
  if (open) root.setAttribute('aria-label', `${message}. 눌러서 사진 앱에서 보기`);
  const image = document.createElement('img'); image.src = url; image.alt = '';
  const text = document.createElement('span'); text.textContent = message;
  root.append(image, text); parent.append(root);
  root.addEventListener('click', () => { open?.(); dismiss(); });
  current = { root, url, timer: window.setTimeout(dismiss, TOAST_SECONDS * 1000) };
  // Next frame, so the card rises in rather than appearing in place.
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('shown')));
}
