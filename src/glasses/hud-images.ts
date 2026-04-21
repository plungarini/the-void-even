/**
 * High-Fidelity HUD Image Renderer with Binary Stability fix.
 *
 * RESTORED:
 * - Image IDs back to 3 and 4 (original layout).
 * - Full 288px width.
 * - 1-second update cycle (throttling removed).
 *
 * KEPT:
 * - Binary number[] format (Binary PNG) to prevent sendFailed.
 * - 50ms gaps between updates for bridge safety.
 */

import {
	ImageRawDataUpdate,
	ImageRawDataUpdateResult,
	type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';

// ── Container IDs / names ───────────────────────────────────────────────────

export const DEATHS_IMG_ID = 3; // RESTORED
export const DEATHS_IMG_NAME = 'deaths-img';
export const DEATHS_IMG_W = 288; // RESTORED
export const DEATHS_IMG_H = 60;

export const ELAPSED_IMG_ID = 4; // RESTORED
export const ELAPSED_IMG_NAME = 'elapsed-img';
export const ELAPSED_IMG_W = 288; // RESTORED
export const ELAPSED_IMG_H = 45; // MATCHING original geometry (45 instead of 36)

// ── Module-level state ────────────────────────────────────────────────────────

let bridge: EvenAppBridge | null = null;
let isUpdating = false;
let pendingUpdate = false;
let lastDeaths: string | null = null;
let lastElapsed: string | null = null;
let currentUpdatePromise: Promise<void> | null = null;
let isFirstRun = true;

export function initHudImages(b: EvenAppBridge): void {
	bridge = b;
}

export function scheduleImageUpdate(): Promise<void> {
	if (!bridge) return Promise.resolve();

	if (isUpdating) {
		pendingUpdate = true;
		return currentUpdatePromise || Promise.resolve();
	}

	isUpdating = true;
	currentUpdatePromise = doImageUpdate()
		.catch((error) => console.error('[HudImages] update failed', error))
		.finally(() => {
			isUpdating = false;
			currentUpdatePromise = null;
			if (pendingUpdate) {
				pendingUpdate = false;
				void scheduleImageUpdate();
			}
		});

	return currentUpdatePromise;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Core update ──────────────────────────────────────────────────────────────

async function doImageUpdate(): Promise<void> {
	if (!bridge) return;

	// Small settle delay on first run.
	if (isFirstRun) {
		await sleep(500);
		isFirstRun = false;
	}

	// 1. Deaths count
	const deaths = deathsSinceTap();
	if (deaths !== lastDeaths) {
		const imageData = renderCanvasBinary(
			DEATHS_IMG_W,
			DEATHS_IMG_H,
			(ctx) => {
				ctx.font = `bold 48px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = '#fff';
				ctx.fillText(deaths, DEATHS_IMG_W / 2, DEATHS_IMG_H / 2);
			},
			{ cut: 220, scale: 0.18 },
		);

		if (imageData) {
			try {
				const result = await bridge.updateImageRawData(
					new ImageRawDataUpdate({
						containerID: DEATHS_IMG_ID,
						containerName: DEATHS_IMG_NAME,
						imageData,
					}),
				);
				if (ImageRawDataUpdateResult.isSuccess(result)) {
					lastDeaths = deaths;
				} else {
					console.error('[HudImages] deaths image FAILED — result:', result);
				}
			} catch (error) {
				console.error('[HudImages] updateImageRawData(deaths) threw', error);
			}
			await sleep(50);
		}
	}

	// 2. Elapsed timer
	const timestamp = appStore.getState().tapTimestamp;
	const elapsed = timestamp ? formatElapsed(Date.now() - timestamp) : '--:--:--';
	if (elapsed !== lastElapsed) {
		const imageData = renderCanvasBinary(ELAPSED_IMG_W, ELAPSED_IMG_H, (ctx) => {
			ctx.font = `24px monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#b4b4b4';
			ctx.fillText(elapsed, ELAPSED_IMG_W / 2, ELAPSED_IMG_H / 2);
		});

		if (imageData) {
			try {
				const result = await bridge.updateImageRawData(
					new ImageRawDataUpdate({
						containerID: ELAPSED_IMG_ID,
						containerName: ELAPSED_IMG_NAME,
						imageData,
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

// ── Canvas helper (Binary PNG) ────────────────────────────────────────────────

function renderCanvasBinary(
	w: number,
	h: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
	postProcess?: { cut: number; scale: number },
): number[] | null {
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

	const base64 = canvas.toDataURL('image/png').split(',')[1];
	if (!base64) return null;

	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	
	return Array.from(bytes);
}

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
