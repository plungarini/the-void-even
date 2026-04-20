/**
 * The single HUD screen for The Void.
 *
 * Layout mirrors smokeless's ROOT_LAYOUT:
 *   0  shield  — invisible full-screen overlay, isEventCapture:1
 *   1  header  — top bar (clock + app name)
 *   2  body    — bordered main content (counter + elapsed)
 *   3  footer  — bottom hint bar
 *
 * Single click resets the counter. Double-click exits the app (required on
 * root page per Even Hub submission rules).
 */

import {
	OsEventTypeList,
	type EvenAppBridge,
	type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import { appStore, deathsSinceTap } from '../app/store';
import { HUD_BORDER_RADIUS, HUD_HEIGHT, HUD_WIDTH } from './constants';
import { scheduleRender } from './render-loop';
import type { HudLayoutDescriptor } from './types';

// ── Layout ────────────────────────────────────────────────────────────────────

const LAYOUT: HudLayoutDescriptor = {
	key: 'void.v1',
	textDescriptors: [
		// Shield: zero-width, full-height invisible overlay — sole event capture
		{
			containerID: 0,
			containerName: 'shield',
			xPosition: 0,
			yPosition: 0,
			width: 0,
			height: HUD_HEIGHT,
			isEventCapture: 1,
		},
		// Header: top-left clock + app name
		{
			containerID: 1,
			containerName: 'header',
			xPosition: 12,
			yPosition: 0,
			width: 240,
			height: 40,
			paddingLength: 4,
		},
		// Body: main content — counter, elapsed, label
		{
			containerID: 2,
			containerName: 'body',
			xPosition: 0,
			yPosition: 37,
			width: HUD_WIDTH,
			height: 213,
			paddingLength: 15,
			borderWidth: 1,
			borderColor: 13,
			borderRadius: HUD_BORDER_RADIUS,
			isEventCapture: 0,
		},
		// Footer: bottom hint
		{
			containerID: 3,
			containerName: 'footer',
			xPosition: 13,
			yPosition: 251,
			width: 350,
			height: 35,
			paddingLength: 4,
		},
	],
};

// ── Formatting helpers ────────────────────────────────────────────────────────

// body inner width = 576 - 2*(15+1) = 544 px
// We use character-based centering here (no pretext dep) because the void
// display is simple enough — numbers + short labels in the default font.
const BODY_CHAR_WIDTH = 44; // approximate chars that fit per line at default size

function padCenter(text: string, width: number = BODY_CHAR_WIDTH): string {
	if (text.length >= width) return text;
	const totalPad = width - text.length;
	const left = Math.floor(totalPad / 2);
	return ' '.repeat(left) + text;
}

function row(label: string, value: string): string {
	// "• Label         Value" filling ~BODY_CHAR_WIDTH
	const entry = `• ${label}`;
	const gap = Math.max(1, BODY_CHAR_WIDTH - entry.length - value.length);
	return `${entry}${' '.repeat(gap)}${value}`;
}

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHeaderTime(now: Date): string {
	return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ── View ──────────────────────────────────────────────────────────────────────

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
		const deathStr = deaths.toLocaleString('en-US');
		const nowDate = new Date(now);

		const header = `${formatHeaderTime(nowDate)}   •   The Void`;

		const body = [
			'',
			padCenter('— memento mori —'),
			'',
			row('Elapsed', elapsed),
			row('Souls entered the void', deathStr),
			'',
			padCenter('╭──  tap to reset  ──╮'),
		].join('\n');

		const footer = `[ Click ] reset   [ 2× click ] exit`;

		return { shield: ' ', header, body, footer };
	}

	handleEvent(event: EvenHubEvent): void {
		const type = event.textEvent?.eventType ?? event.sysEvent?.eventType;

		// DOUBLE_CLICK wins — check before CLICK so the phantom click that
		// follows a double-tap doesn't accidentally reset the counter.
		if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
			void this.exitApp();
			return;
		}
		// CLICK_EVENT = 0, normalised to `undefined` by the bridge.
		if (type === OsEventTypeList.CLICK_EVENT || type === undefined) {
			appStore.tap();
			scheduleRender();
		}
	}

	private async exitApp(): Promise<void> {
		if (!this.bridge) return;
		try {
			// Mode 1 = show the host exit dialog (required on root page).
			await this.bridge.shutDownPageContainer(1);
		} catch (error) {
			console.error('[VoidView] shutDownPageContainer threw', error);
		}
	}
}

export const voidView = new VoidView();
