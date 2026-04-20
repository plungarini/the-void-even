/**
 * Canvas image renderer for the two HUD image containers:
 *   - deaths count  (large bold font)
 *   - elapsed timer (small light monospace font)
 *
 * Both are pushed via `bridge.updateImageRawData` after the page is created.
 *
 * KEY RULES from the SDK docs:
 * - "Cannot send image data during createStartUpPageContainer."
 * - "No concurrent image sends — queue sequentially."
 * - "Do NOT perform 1-bit dithering — the host does better 4-bit downsampling."
 *
 * GLOW STRATEGY
 * The glow is caused by two compounding effects:
 *   1. Anti-aliased text edges produce faint semi-transparent fringe pixels.
 *      Even at low brightness the micro-LED turns those into a visible halo.
 *   2. High pixel brightness amplifies the LED's physical light bleed.
 *
 * Fix (deaths counter): draw text at full white, then apply a two-pass pixel
 * post-process — hard-cut all fringe pixels below 200/255 (the anti-aliased
 * halo), then scale surviving body pixels down by 0.33 so the micro-LED stays
 * at level ~5/16, well below bloom saturation. This is NOT 1-bit dithering:
 * only the fringe is zeroed; the host's 4-bit downsampling handles the body.
 * The elapsed timer skips post-processing — its thin strokes can't survive a
 * hard cut, so it relies entirely on the host's native downsampler.
 */

import { ImageRawDataUpdate, type EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';

// ── Container IDs / names (must match imageObject in void-view.ts) ────────────

export const DEATHS_IMG_ID = 3;
export const DEATHS_IMG_NAME = 'deaths-img';
export const DEATHS_IMG_W = 288;
export const DEATHS_IMG_H = 60;

export const ELAPSED_IMG_ID = 4;
export const ELAPSED_IMG_NAME = 'elapsed-img';
export const ELAPSED_IMG_W = 288;
export const ELAPSED_IMG_H = 36; // shorter — smaller font

// ── Per-image render config ───────────────────────────────────────────────────
//
// Deaths counter — draw white, then apply two-pass pixel processing:
//   1. Hard cut: pixels below DEATHS_CUT (220/255) are zeroed.
//      Drawing in white means fully-covered pixels = 255, fringe = 0–219.
//      Cutting at 220 removes all anti-aliased fringe (typically 0–200).
//   2. Scale down: surviving pixels (220–255) are multiplied by DEATHS_SCALE.
//      At 0.18 → 220*0.18=40 … 255*0.18=46 ≈ level 2–3/16.
//      This keeps the LED well below saturation so no physical bloom occurs.
//
// This is robust against WebView color management because we always draw
// at full white and then control brightness in the pixel buffer directly.
const DEATHS_DRAW_COLOR = '#ffffff';
const DEATHS_CUT = 220; // fringe hard-cut threshold (0–255)
const DEATHS_SCALE = 0.18; // brightness scale applied after cut → ~level 2-3/16

// Elapsed timer — thin light-weight font; any threshold destroys the strokes.
// Just draw at a visible grey and let the host's 4-bit downsampler handle edges.
const ELAPSED_COLOR = '#b4b4b4';

// ── Module-level state ────────────────────────────────────────────────────────

let bridge: EvenAppBridge | null = null;
let isUpdating = false;
let pendingUpdate = false;
let lastDeaths: string | null = null;
let lastElapsed: string | null = null;

export function initHudImages(b: EvenAppBridge): void {
	bridge = b;
}

/**
 * Schedule an image update pass. Called from the render-loop after every
 * text render. Excess calls while in-flight collapse into one pending update.
 */
export function scheduleImageUpdate(): void {
	if (!bridge) return;
	if (isUpdating) {
		pendingUpdate = true;
		return;
	}
	isUpdating = true;
	void doImageUpdate()
		.catch((error) => console.error('[HudImages] update failed', error))
		.finally(() => {
			isUpdating = false;
			if (pendingUpdate) {
				pendingUpdate = false;
				scheduleImageUpdate();
			}
		});
}

// ── Core update (sequential — SDK forbids concurrent image sends) ─────────────

async function doImageUpdate(): Promise<void> {
	if (!bridge) return;

	// Deaths count — update only when the number changes.
	const deaths = !lastDeaths ? '--' : deathsSinceTap();
	if (deaths !== lastDeaths) {
		const data = renderCanvas(
			DEATHS_IMG_W,
			DEATHS_IMG_H,
			(ctx) => {
				const text = deaths;
				const fontSize = text.length <= 5 ? 48 : text.length <= 8 ? 40 : 34;
				ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = DEATHS_DRAW_COLOR;
				ctx.fillStyle = DEATHS_DRAW_COLOR;
				ctx.fillText(text, DEATHS_IMG_W / 2, DEATHS_IMG_H / 2);
			},
			{ cut: DEATHS_CUT, scale: DEATHS_SCALE },
		);
		if (data) {
			await bridge.updateImageRawData(
				new ImageRawDataUpdate({ containerID: DEATHS_IMG_ID, containerName: DEATHS_IMG_NAME, imageData: data }),
			);
			lastDeaths = deaths;
		}
	}

	// Elapsed timer — updates every second via the 1-sec tick.
	const timestamp = appStore.getState().tapTimestamp;
	const elapsed = timestamp && lastElapsed !== null ? formatElapsed(Date.now() - timestamp) : '--:--:--';
	if (elapsed !== lastElapsed) {
		const data = renderCanvas(ELAPSED_IMG_W, ELAPSED_IMG_H, (ctx) => {
			ctx.font = `300 22px 'Courier New', 'Lucida Console', monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = ELAPSED_COLOR;
			ctx.fillText(elapsed, ELAPSED_IMG_W / 2, ELAPSED_IMG_H / 2);
		});
		if (data) {
			await bridge.updateImageRawData(
				new ImageRawDataUpdate({ containerID: ELAPSED_IMG_ID, containerName: ELAPSED_IMG_NAME, imageData: data }),
			);
			lastElapsed = elapsed;
		}
	}
}

// ── Canvas helper ─────────────────────────────────────────────────────────────

/**
 * Create a black canvas, run `draw`, optionally apply a two-pass pixel
 * post-process, return base64 PNG.
 *
 * @param postProcess  Optional per-pixel pass:
 *   - cut:   pixels whose red channel is below this value are zeroed
 *             (removes anti-aliased fringe entirely).
 *   - scale: surviving pixels are multiplied by this factor
 *             (brings character body below LED bloom threshold).
 *   Omit to let the host's native 4-bit downsampler handle edges
 *   (correct for the thin elapsed-timer strokes).
 */
function renderCanvas(
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
	postProcess?: { cut: number; scale: number },
): string {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	// Black background (= LED off).
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, w, h);

	draw(ctx);

	// Two-pass pixel post-process (deaths counter only).
	// Pass 1 — hard cut: zero the anti-aliased fringe.
	// Pass 2 — scale down: dim the character body so the micro-LED
	//           stays well below physical bloom saturation.
	if (postProcess) {
		const { cut, scale } = postProcess;
		const imgData = ctx.getImageData(0, 0, w, h);
		const d = imgData.data;
		for (let i = 0; i < d.length; i += 4) {
			const v = d[i] ?? 0;
			const out = v < cut ? 0 : Math.round(v * scale);
			d[i] = d[i + 1] = d[i + 2] = out;
			// alpha unchanged
		}
		ctx.putImageData(imgData, 0, 0);
	}

	return canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
