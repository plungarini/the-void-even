/**
 * The single HUD screen for The Void.
 * 
 * RESTORED: Full original high-fidelity layout with Headers, Borders, and Shield.
 */

import {
	ImageContainerProperty,
	OsEventTypeList,
	type EvenAppBridge,
	type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';
import { HUD_BORDER_RADIUS, HUD_HEIGHT, HUD_WIDTH } from './constants';
import {
	DEATHS_IMG_H,
	DEATHS_IMG_ID,
	DEATHS_IMG_NAME,
	DEATHS_IMG_W,
	ELAPSED_IMG_H,
	ELAPSED_IMG_ID,
	ELAPSED_IMG_NAME,
	ELAPSED_IMG_W,
} from './hud-images';
import { scheduleRender } from './render-loop';
import type { HudLayoutDescriptor } from './types';
import { alignRow, centerLine } from './utils';

// ── Geometry ──────────────────────────────────────────────────────────────────

const BODY_Y = 37;
const BODY_HEIGHT = HUD_HEIGHT - BODY_Y; // 251

// body inner top = BODY_Y + paddingLength + borderWidth = 37+15+1 = 53
const BODY_INNER_TOP = BODY_Y + 15 + 1; // 53

// Deaths image: 15 px padding below body inner top → y=68, bottom=128
const DEATHS_IMG_Y = BODY_INNER_TOP + 25; // 68
const DEATHS_IMG_X = (HUD_WIDTH - DEATHS_IMG_W) / 2; // 144

// Elapsed image: line-6 position = body inner top + 6 lines
// 6 × 26 = 156 → y = 53+156 = 209  (image bottom = 209+45 = 254 < inner bottom 272 ✓)
const ELAPSED_IMG_Y = BODY_INNER_TOP + 6 * 26; // 209
const ELAPSED_IMG_X = (HUD_WIDTH - ELAPSED_IMG_W) / 2; // 144

// ── Layout ────────────────────────────────────────────────────────────────────

const LAYOUT: HudLayoutDescriptor = {
	key: 'void.v9', // BUMP: Layout restoration
	textDescriptors: [
		// Ghost event container: full-screen, sole isEventCapture:1.
		// Full width required for scroll events. No border/padding → invisible.
		{
			containerID: 0,
			containerName: 'shield',
			xPosition: 0,
			yPosition: 0,
			width: HUD_WIDTH,
			height: HUD_HEIGHT,
			borderWidth: 0,
			paddingLength: 0,
			isEventCapture: 1,
		},
		// Header: full-width top bar.
		{
			containerID: 1,
			containerName: 'header',
			xPosition: 12,
			yPosition: 0,
			width: HUD_WIDTH - 24,
			height: 40,
			paddingLength: 4,
		},
		// Body: only "souls entered the void" rendered as text. Both numbers
		// are image containers so they are truly pixel-centred and never jitter.
		{
			containerID: 2,
			containerName: 'body',
			xPosition: 0,
			yPosition: BODY_Y,
			width: HUD_WIDTH,
			height: BODY_HEIGHT,
			paddingLength: 15,
			borderWidth: 1,
			borderColor: 13,
			borderRadius: HUD_BORDER_RADIUS,
			isEventCapture: 0,
		},
	],
	// Placeholder containers — pixel data pushed after page creation by hud-images.ts.
	imageObject: [
		new ImageContainerProperty({
			containerID: DEATHS_IMG_ID,
			containerName: DEATHS_IMG_NAME,
			xPosition: DEATHS_IMG_X,
			yPosition: DEATHS_IMG_Y,
			width: DEATHS_IMG_W,
			height: DEATHS_IMG_H,
		}),
		new ImageContainerProperty({
			containerID: ELAPSED_IMG_ID,
			containerName: ELAPSED_IMG_NAME,
			xPosition: ELAPSED_IMG_X,
			yPosition: ELAPSED_IMG_Y,
			width: ELAPSED_IMG_W,
			height: ELAPSED_IMG_H,
		}),
	],
};

// ── Inner pixel widths ────────────────────────────────────────────────────────
const HEADER_INNER_PX = HUD_WIDTH - 24 - 8; // 544
const BODY_INNER_PX = HUD_WIDTH - 2 * 16; // 544

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatHeaderTime(now: Date): string {
	return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ── View ──────────────────────────────────────────────────────────────────────

class VoidView {
	private bridge: any | null = null;

	attachBridge(bridge: any): void {
		this.bridge = bridge;
	}

	layout(): HudLayoutDescriptor {
		return LAYOUT;
	}

	contents(): Record<string, string> {
		const nowDate = new Date();

		// Header: time flush-left, app name flush-right.
		const header = alignRow(formatHeaderTime(nowDate), 'the void', HEADER_INNER_PX);

		// Body: blank lines hold space for the two image containers.
		// Line 4 has the only text. 7 lines × 26 px = 182 px < 219 px inner ✓
		const body = [
			'', // line 0 — deaths image area (y=68..128)
			'', // line 1
			'', // line 2
			'', // line 3 — gap below deaths image
			centerLine('souls entered the void', BODY_INNER_PX), // line 4 y≈157
			'', // line 5
			'', // line 6 — elapsed image area (y=209..254)
		].join('\n');

		return { shield: ' ', header, body };
	}

	handleEvent(event: EvenHubEvent): void {
		const type = event.textEvent?.eventType ?? event.sysEvent?.eventType;

		// DOUBLE_CLICK wins — prevents the phantom CLICK after a double-tap
		// from resetting the counter.
		if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
			void this.exitApp();
			return;
		}
		// CLICK_EVENT = 0 normalised to `undefined` by the bridge.
		if (type === OsEventTypeList.CLICK_EVENT || type === undefined) {
			appStore.tap();
			scheduleRender();
		}
	}

	private async exitApp(): Promise<void> {
		if (!this.bridge) return;
		try {
			await this.bridge.shutDownPageContainer(1);
		} catch (error) {
			console.error('[VoidView] shutDownPageContainer threw', error);
		}
	}
}

export const voidView = new VoidView();
