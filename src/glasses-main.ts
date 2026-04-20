/**
 * Pure-TS entry point for the glasses/HUD layer. Runs alongside `main.tsx`
 * (React) — both are pulled into the same module graph via a side-effect
 * import. They share state through `./app/store` only.
 */

import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { appStore } from './app/store';
import { initEventDispatcher } from './glasses/events';
import { initRenderLoop, scheduleRender } from './glasses/render-loop';
import { HudSession } from './glasses/session';
import { startTick } from './glasses/tick';
import { voidView } from './glasses/void-view';
import { startDeathRateBootstrap } from './services/death-rate';

async function main(): Promise<void> {
	// Fire the World Bank fetch immediately — the store populates when it
	// resolves. Fallback rate is already in place in the meantime.
	startDeathRateBootstrap();

	let bridge;
	try {
		bridge = await waitForEvenAppBridge();
	} catch (error) {
		console.error('[GlassesMain] bridge unavailable', error);
		return;
	}

	voidView.attachBridge(bridge);

	const session = new HudSession(bridge);
	initRenderLoop(session);
	initEventDispatcher(bridge);

	// Re-render whenever shared state changes (tap, death rate resolved).
	appStore.subscribe(scheduleRender);

	// 1-second tick keeps the elapsed clock + death count alive.
	startTick();

	// First paint.
	scheduleRender();
}

void main().catch((error) => {
	console.error('[GlassesMain] fatal', error);
});
