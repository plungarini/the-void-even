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
 * - "Recommended: number[] (List<int>) for image data."
 */

import {
	ImageRawDataUpdate,
	ImageRawDataUpdateResult,
	type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';

// ── Container IDs / names (must match imageObject in void-view.ts) ────────────

export const DEATHS_IMG_ID = 3;
export const DEATHS_IMG_NAME = 'deaths-img';
export const DEATHS_IMG_W = 288;
export const DEATHS_IMG_H = 60;

export const ELAPSED_IMG_ID = 4;
export const ELAPSED_IMG_NAME = 'elapsed-img';
export const ELAPSED_IMG_W = 288;
export const ELAPSED_IMG_H = 36;

// ── Per-image render config ───────────────────────────────────────────────────

const DEATHS_DRAW_COLOR = '#ffffff';
const DEATHS_CUT = 220;
const DEATHS_SCALE = 0.18;

const ELAPSED_COLOR = '#b4b4b4';

// ── Module-level state ────────────────────────────────────────────────────────

let bridge: EvenAppBridge | null = null;
let isUpdating = false;
let pendingUpdate = false;
let lastDeaths: string | null = null;
let lastElapsed: string | null = null;
let isFirstRun = true;

export function initHudImages(b: EvenAppBridge): void {
	bridge = b;
}

/**
 * Schedule an image update pass.
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

// ── Shared Helpers ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dataURLToUint8Array(dataURL: string): Uint8Array {
	const base64 = dataURL.includes(',') ? dataURL.split(',')[1] : dataURL;
	const binaryString = atob(base64!);
	const len = binaryString.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes;
}

// ── Core update ──────────────────────────────────────────────────────────────

async function doImageUpdate(): Promise<void> {
	if (!bridge) return;

	// On very first run, wait for the glasses to settle after page creation.
	if (isFirstRun) {
		console.log('[HudImages] first run: waiting 1s for glasses to settle...');
		await sleep(1000);
		isFirstRun = false;
	}

	// Deaths count — update only when the number changes.
	const deaths = !lastDeaths ? '--' : deathsSinceTap();
	if (deaths !== lastDeaths) {
		const bytes = renderCanvas(
			DEATHS_IMG_W,
			DEATHS_IMG_H,
			(ctx) => {
				const text = deaths;
				const fontSize = text.length <= 5 ? 48 : text.length <= 8 ? 40 : 34;
				ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = DEATHS_DRAW_COLOR;
				ctx.fillText(text, DEATHS_IMG_W / 2, DEATHS_IMG_H / 2);
			},
			{ cut: DEATHS_CUT, scale: DEATHS_SCALE },
		);

		if (bytes) {
			try {
				console.log(`[HudImages] sending deaths image (${bytes.length} bytes)...`);
				const result = await bridge.updateImageRawData(
					new ImageRawDataUpdate({
						containerID: DEATHS_IMG_ID,
						containerName: DEATHS_IMG_NAME,
						imageData: bytes, // passing Uint8Array (SDK converts to number[])
					}),
				);
				if (ImageRawDataUpdateResult.isSuccess(result)) {
					console.log('[HudImages] deaths image sent OK');
					lastDeaths = deaths;
				} else {
					console.error('[HudImages] deaths image FAILED — result:', result);
				}
			} catch (error) {
				console.error('[HudImages] updateImageRawData(deaths) threw', error);
			}
			// Small gap between images to avoid overwhelming BLE.
			await sleep(200);
		}
	}

	// Elapsed timer — updates every second.
	const timestamp = appStore.getState().tapTimestamp;
	const elapsed = timestamp && lastElapsed !== null ? formatElapsed(Date.now() - timestamp) : '--:--:--';
	if (elapsed !== lastElapsed) {
		const bytes = renderCanvas(ELAPSED_IMG_W, ELAPSED_IMG_H, (ctx) => {
			ctx.font = `300 22px 'Courier New', 'Lucida Console', monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = ELAPSED_COLOR;
			ctx.fillText(elapsed, ELAPSED_IMG_W / 2, ELAPSED_IMG_H / 2);
		});

		if (bytes) {
			try {
				const result = await bridge.updateImageRawData(
					new ImageRawDataUpdate({
						containerID: ELAPSED_IMG_ID,
						containerName: ELAPSED_IMG_NAME,
						imageData: bytes,
					}),
				);
				if (ImageRawDataUpdateResult.isSuccess(result)) {
					lastElapsed = elapsed;
				} else {
					console.error('[HudImages] elapsed image FAILED — result:', result);
				}
			} catch (error) {
				console.error('[HudImages] updateImageRawData(elapsed) threw', error);
			}
		}
	}
}

// ── Canvas helper ─────────────────────────────────────────────────────────────

function renderCanvas(
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
	postProcess?: { cut: number; scale: number },
): Uint8Array | null {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, w, h);

	draw(ctx);

	if (postProcess) {
		const { cut, scale } = postProcess;
		const imgData = ctx.getImageData(0, 0, w, h);
		const d = imgData.data;
		for (let i = 0; i < d.length; i += 4) {
			const v = d[i] ?? 0;
			const out = v < cut ? 0 : Math.round(v * scale);
			d[i] = d[i + 1] = d[i + 2] = out;
		}
		ctx.putImageData(imgData, 0, 0);
	}

	const dataURL = canvas.toDataURL('image/png');
	return dataURLToUint8Array(dataURL);
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
