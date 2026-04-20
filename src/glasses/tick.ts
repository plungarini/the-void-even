/**
 * 1-second render ticker. Modelled after smokeless's home-timer — the
 * counter display needs to update every second even when no store event
 * fires, so we pump the render loop on an interval.
 */

import { scheduleRender } from './render-loop';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTick(): void {
	if (intervalId !== null) return;
	intervalId = setInterval(() => scheduleRender(), 1_000);
}

export function stopTick(): void {
	if (intervalId === null) return;
	clearInterval(intervalId);
	intervalId = null;
}
