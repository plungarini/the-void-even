/**
 * Pixel-accurate text layout helpers for the G2 HUD.
 *
 * The glasses font is proportional (not monospaced), so character-count-based
 * padding is inaccurate. `@evenrealities/pretext` measures each string in the
 * same font metrics the firmware uses, letting us pad with the exact number of
 * spaces needed to hit a target pixel width.
 */

import { getTextWidth } from '@evenrealities/pretext';

// One space in the default G2 font.
const SPACE_WIDTH = getTextWidth(' ') || 5;

// Small safety cushion — LVGL wraps aggressively; even 1 px over drops a line.
const WRAP_SAFETY_PX = 4;

/** Returns spaces whose combined rendered width is ≤ targetPx. */
function spacesForPx(targetPx: number): string {
	if (targetPx <= 0) return '';
	const count = Math.floor(targetPx / SPACE_WIDTH);
	return count > 0 ? ' '.repeat(count) : '';
}

/** Centres a single line of text within an inner pixel width using space padding. */
export function centerLine(text: string, innerWidthPx: number): string {
	const w = getTextWidth(text);
	const leftPx = Math.max(0, (innerWidthPx - WRAP_SAFETY_PX - w) / 2);
	return `${spacesForPx(leftPx)}${text}`;
}

/**
 * Aligns a two-column row: `left` flush-left, `right` flush-right.
 * Uses real per-character metrics so columns land on pixel boundaries.
 */
export function alignRow(left: string, right: string, innerWidthPx: number): string {
	const available = innerWidthPx - WRAP_SAFETY_PX - getTextWidth(left) - getTextWidth(right);
	if (available <= 0) return `${left} ${right}`;
	return `${left}${spacesForPx(available)}${right}`;
}
