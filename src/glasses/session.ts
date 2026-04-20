/**
 * Thin wrapper over the Even SDK bridge that turns a `HudRenderState` into
 * the right SDK call: `createStartUpPageContainer` on first render,
 * `rebuildPageContainer` when the layout key changes, and
 * `textContainerUpgrade` for content-only updates.
 *
 * Module-level singletons (pageCreated, activeLayoutKey, lastContents)
 * guard against the SDK's rule that createStartUpPageContainer may only be
 * called once per app lifetime. Only a full reload resets these.
 */

import {
	CreateStartUpPageContainer,
	RebuildPageContainer,
	StartUpPageCreateResult,
	TextContainerProperty,
	TextContainerUpgrade,
	type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { HUD_CONTENT_CHAR_LIMIT } from './constants';
import type { HudLayoutDescriptor, HudRenderState } from './types';

let pageCreated = false;
let activeLayoutKey: string | null = null;
let lastContents: Record<string, string> = {};

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	return value.slice(0, Math.max(0, max - 1)) + '…';
}

function instantiateLayout(
	layout: HudLayoutDescriptor,
	textContents: Record<string, string>,
) {
	return {
		containerTotalNum: layout.textDescriptors.length,
		textObject: layout.textDescriptors.map(
			(d) =>
				new TextContainerProperty({
					...d,
					content: truncate(textContents[d.containerName] ?? ' ', HUD_CONTENT_CHAR_LIMIT),
				}),
		),
	};
}

export class HudSession {
	private readonly bridge: EvenAppBridge;

	constructor(bridge: EvenAppBridge) {
		this.bridge = bridge;
	}

	async render(next: HudRenderState): Promise<void> {
		const params = instantiateLayout(next.layout, next.textContents);

		if (!pageCreated) {
			let created: StartUpPageCreateResult;
			try {
				created = await this.bridge.createStartUpPageContainer(
					new CreateStartUpPageContainer(params),
				);
			} catch (error) {
				console.error('[HudSession] createStartUpPage threw', error);
				return;
			}
			if (created === StartUpPageCreateResult.success) {
				pageCreated = true;
				activeLayoutKey = next.layout.key;
				lastContents = { ...next.textContents };
				return;
			}
			// Fallback: session already has a page from a prior load. Rebuild.
			try {
				const ok = await this.bridge.rebuildPageContainer(new RebuildPageContainer(params));
				if (ok) {
					pageCreated = true;
					activeLayoutKey = next.layout.key;
					lastContents = { ...next.textContents };
				}
			} catch (error) {
				console.error('[HudSession] rebuild fallback threw', error);
			}
			return;
		}

		if (activeLayoutKey !== next.layout.key) {
			try {
				const ok = await this.bridge.rebuildPageContainer(new RebuildPageContainer(params));
				if (!ok) return;
			} catch (error) {
				console.error('[HudSession] rebuild threw', error);
				return;
			}
			activeLayoutKey = next.layout.key;
			lastContents = {};
		}

		await this.applyUpgrades(next);
	}

	private async applyUpgrades(next: HudRenderState): Promise<void> {
		for (const descriptor of next.layout.textDescriptors) {
			const content = next.textContents[descriptor.containerName] ?? '';
			if (lastContents[descriptor.containerName] === content) continue;
			const previousLength = lastContents[descriptor.containerName]?.length ?? 0;
			try {
				const ok = await this.bridge.textContainerUpgrade(
					new TextContainerUpgrade({
						containerID: descriptor.containerID,
						containerName: descriptor.containerName,
						contentOffset: 0,
						contentLength: Math.max(content.length, previousLength),
						content,
					}),
				);
				if (!ok) continue;
				lastContents[descriptor.containerName] = content;
			} catch (error) {
				console.error('[HudSession] textContainerUpgrade threw', error);
			}
		}
	}
}
