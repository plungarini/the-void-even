/**
 * Pure-TS entry point for the glasses/HUD layer. Runs alongside `main.tsx`
 * (React) — both are pulled into the same module graph via a side-effect
 * import. They share state through `./app/store` only.
 */

import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { appStore } from './app/store';
import { initHudImages } from './glasses/hud-images';
import { initEventDispatcher } from './glasses/events';
import { initRenderLoop, scheduleRender } from './glasses/render-loop';
import { HudSession } from './glasses/session';
import { startTick } from './glasses/tick';
import { voidView } from './glasses/void-view';
import { startDeathRateBootstrap } from './services/death-rate';

// Bridge localStorage key — namespaced to avoid collisions with other apps.
const STORAGE_KEY_TAP = 'thevoid.tapTimestamp';

async function main(): Promise<void> {
	console.log('[GlassesMain] starting up');
	// Start World Bank fetch early — fallback rate is in the store already.
	startDeathRateBootstrap();

	let bridge;
	try {
		console.log('[GlassesMain] waiting for Even bridge...');
		bridge = await waitForEvenAppBridge();
		console.log('[GlassesMain] bridge acquired');
	} catch (error) {
		console.error('[GlassesMain] bridge unavailable', error);
		return;
	}

	// ── Restore persisted tap timestamp ───────────────────────────────────────
	// Bridge localStorage survives app restarts (unlike browser localStorage
	// which is wiped when the Even Hub WebView restarts). Load it before the
	// first render so the counter continues from where the user left off.
	try {
		const saved = await bridge.getLocalStorage(STORAGE_KEY_TAP);
		const ms = Number(saved);
		if (saved && Number.isFinite(ms) && ms > 0) {
			appStore.setTapTimestamp(ms);
			console.log(`[GlassesMain] restored tapTimestamp from storage: ${ms}`);
		}
	} catch (error) {
		console.warn('[GlassesMain] could not load tapTimestamp from storage', error);
	}

	voidView.attachBridge(bridge);
	console.log('[GlassesMain] bridge attached to voidView');
	initHudImages(bridge);
	console.log('[GlassesMain] hud images initialised');

	const session = new HudSession(bridge);
	initRenderLoop(session);
	initEventDispatcher(bridge);
	console.log('[GlassesMain] render loop + event dispatcher ready');

	// ── Persist tap timestamp whenever it changes ─────────────────────────────
	// Subscribe to store; fire-and-forget save on every tap event.
	let lastSavedTap = appStore.getState().tapTimestamp;
	appStore.subscribe(() => {
		const { tapTimestamp } = appStore.getState();
		if (tapTimestamp !== lastSavedTap) {
			lastSavedTap = tapTimestamp;
			void bridge.setLocalStorage(STORAGE_KEY_TAP, String(tapTimestamp))
				.then((ok) => {
					if (!ok) console.warn('[GlassesMain] setLocalStorage returned false');
				})
				.catch((err) => console.error('[GlassesMain] setLocalStorage threw', err));
		}
	});

	// ── Wire up the rest ──────────────────────────────────────────────────────
	// Re-render whenever shared state changes (tap, death rate resolved).
	appStore.subscribe(scheduleRender);

	// 1-second tick keeps the elapsed clock + death count alive.
	startTick();

	// First paint.
	console.log('[GlassesMain] triggering first render');
	scheduleRender();
	console.log('[GlassesMain] startup complete');
}

void main().catch((error) => {
	console.error('[GlassesMain] fatal', error);
});
