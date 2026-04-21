/**
 * Pure-TS entry point for the glasses/HUD layer. Runs alongside `main.tsx`
 * (React) - both are pulled into the same module graph via a side-effect
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

// Bridge localStorage key - namespaced to avoid collisions with other apps.
const STORAGE_KEY_TAP = 'thevoid.tapTimestamp';

async function main(): Promise<void> {
  console.log('[GlassesMain] starting up');
  
  // Start World Bank fetch early.
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

  // ── Persistence Recovery ──────────────────────────────────────────────────
  let initialSavedValue: string | null = null;
  try {
    console.log('[Persistence] checking bridge for saved data...');
    initialSavedValue = await bridge.getLocalStorage(STORAGE_KEY_TAP);
    const ms = Number(initialSavedValue);
    
    if (initialSavedValue && Number.isFinite(ms) && ms > 0) {
      appStore.setTapTimestamp(ms);
      console.log(`[Persistence] SUCCESS: Restored timestamp from bridge: ${ms}`);
    } else {
      console.log('[Persistence] No valid saved data found in bridge.');
    }
  } catch (error) {
    console.warn('[Persistence] Check failed', error);
  }

  // ── Component Initialisation ──────────────────────────────────────────────

  voidView.attachBridge(bridge);
  initHudImages(bridge);
  const session = new HudSession(bridge);
  initRenderLoop(session);
  initEventDispatcher(bridge);

  // ── Safe Persistence Sync ─────────────────────────────────────────────────

  // Only subscribe to SAVING after we've tried LOADING. 
  // This prevents us from overwriting bridge data with "undefined" during boot.
  let lastSavedTap = appStore.getState().tapTimestamp;
  
  appStore.subscribe(() => {
    const { tapTimestamp } = appStore.getState();
    // Safety check: Don't save undefined/NaN to the bridge!
    if (tapTimestamp && tapTimestamp !== lastSavedTap) {
      lastSavedTap = tapTimestamp;
      console.log('[Persistence] Saving new timestamp to bridge:', tapTimestamp);
      bridge.setLocalStorage(STORAGE_KEY_TAP, String(tapTimestamp))
        .catch((err) => console.error('[Persistence] Save failed', err));
    }
  });

  // Re-render whenever shared state changes
  appStore.subscribe(scheduleRender);

  // ── Run ───────────────────────────────────────────────────────────────────

  startTick();
  console.log('[GlassesMain] triggering first render');
  scheduleRender();
  console.log('[GlassesMain] startup complete');
}

void main().catch((error) => {
  console.error('[GlassesMain] fatal', error);
});
