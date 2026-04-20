/**
 * Debounced render scheduler. Keeps at most one render in-flight plus one
 * queued so rapid store changes coalesce instead of stacking SDK calls.
 */

import { voidView } from './void-view';
import { HudSession } from './session';

let session: HudSession | null = null;
let isRendering = false;
let renderQueued = false;

export function initRenderLoop(glassesSession: HudSession): void {
	session = glassesSession;
}

export function scheduleRender(): void {
	if (!session) return;
	if (isRendering) {
		renderQueued = true;
		return;
	}
	isRendering = true;
	void doRender()
		.catch((error) => console.error('[RenderLoop] render failed', error))
		.finally(() => {
			isRendering = false;
			if (renderQueued) {
				renderQueued = false;
				scheduleRender();
			}
		});
}

async function doRender(): Promise<void> {
	if (!session) return;
	await session.render({
		layout: voidView.layout(),
		textContents: voidView.contents(),
	});
}
