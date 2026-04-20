/**
 * Event dispatcher. Forwards every bridge event to the single HUD screen.
 * There's only one view in this app, so no routing — just deliver.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import { voidView } from './void-view';

export function initEventDispatcher(bridge: EvenAppBridge): void {
	bridge.onEvenHubEvent((event) => {
		try {
			voidView.handleEvent(event);
		} catch (error) {
			console.error('[GlassesEvents] handler threw', error);
		}
	});
}
