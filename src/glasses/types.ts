/**
 * Layout + render state types for the glasses HUD.
 */

import type { ImageContainerProperty } from '@evenrealities/even_hub_sdk';

export interface HudTextDescriptor {
	containerID: number;
	containerName: string;
	xPosition: number;
	yPosition: number;
	width: number;
	height: number;
	paddingLength?: number;
	borderWidth?: number;
	borderRadius?: number;
	borderColor?: number;
	isEventCapture?: number;
}

export interface HudLayoutDescriptor {
	key: string;
	textDescriptors: HudTextDescriptor[];
	imageObject?: ImageContainerProperty[];
}

export interface HudRenderState {
	layout: HudLayoutDescriptor;
	textContents: Record<string, string>;
}
