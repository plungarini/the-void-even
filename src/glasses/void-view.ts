/**
 * The single HUD screen — "the void". One full-screen text container
 * shows the running deaths count since the last tap, alongside a memento
 * mori header. Clicks reset the counter; double-clicks exit the app (root
 * page submission requirement).
 */

import {
	OsEventTypeList,
	type EvenAppBridge,
	type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';
import { HUD_HEIGHT, HUD_WIDTH } from './constants';
import { scheduleRender } from './render-loop';
import type { HudLayoutDescriptor } from './types';

const LAYOUT: HudLayoutDescriptor = {
	key: 'void.v1',
	textDescriptors: [
		{
			containerID: 1,
			containerName: 'void',
			xPosition: 0,
			yPosition: 0,
			width: HUD_WIDTH,
			height: HUD_HEIGHT,
			paddingLength: 24,
			borderWidth: 0,
			isEventCapture: 1,
		},
	],
};

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatNumber(value: number): string {
	return value.toLocaleString('en-US');
}

class VoidView {
	private bridge: EvenAppBridge | null = null;

	attachBridge(bridge: EvenAppBridge): void {
		this.bridge = bridge;
	}

	layout(): HudLayoutDescriptor {
		return LAYOUT;
	}

	contents(): Record<string, string> {
		const now = Date.now();
		const state = appStore.getState();
		const deaths = deathsSinceTap(now);
		const elapsed = formatElapsed(now - state.tapTimestamp);

		const body = [
			'',
			'         — The Void —',
			'',
			`  Since your last tap: ${elapsed}`,
			'',
			`      ${formatNumber(deaths)} souls`,
			'      have entered the void.',
			'',
			'        tap to reset',
		].join('\n');

		return { void: body };
	}

	handleEvent(event: EvenHubEvent): void {
		const type = event.textEvent?.eventType ?? event.sysEvent?.eventType;

		// DOUBLE_CLICK first — firmware emits a phantom CLICK right after it,
		// and on the root page double-click must exit the app (submission rule).
		if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
			void this.exitApp();
			return;
		}
		// CLICK_EVENT = 0, which the bridge normalises to `undefined`.
		if (type === OsEventTypeList.CLICK_EVENT || type === undefined) {
			appStore.tap();
			scheduleRender();
		}
	}

	private async exitApp(): Promise<void> {
		if (!this.bridge) return;
		try {
			// Mode 1 = show the host exit dialog (required on the root page).
			await this.bridge.shutDownPageContainer(1);
		} catch (error) {
			console.error('[VoidView] shutDownPageContainer threw', error);
		}
	}
}

export const voidView = new VoidView();
