/**
 * Shared app state — the single source of truth bridging the React web UI
 * and the pure-TS glasses layer. Neither side imports the other; they both
 * read/write this store and subscribe to changes.
 *
 * State is intentionally tiny: a tap timestamp (reset moment) and the
 * resolved deaths-per-second rate fetched from World Bank open data.
 */

// 2024 crude death rate fallback (deaths/sec, world). Used when the fetch
// fails — better a mildly stale figure than a fabricated one.
export const FALLBACK_DEATHS_PER_SEC = 2.04;

export const MAX_DEATHS = 9999999999999;

export interface AppState {
	tapTimestamp?: number;
	deathsPerSec: number;
	rateSource: 'fallback' | 'worldbank';
}

type Listener = () => void;

let state: AppState = {
	tapTimestamp: undefined,
	deathsPerSec: FALLBACK_DEATHS_PER_SEC,
	rateSource: 'fallback',
};

const listeners = new Set<Listener>();

function notify(): void {
	for (const listener of listeners) {
		try {
			listener();
		} catch (error) {
			console.error('[Store] listener threw', error);
		}
	}
}

export const appStore = {
	getState(): AppState {
		return state;
	},

	subscribe(listener: Listener): () => void {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},

	/** Reset the counter to "now". Called from the web tap button and from
	 * the glasses click handler. */
	tap(): void {
		state = { ...state, tapTimestamp: Date.now() };
		notify();
	},

	/** Restore a previously saved tap timestamp (e.g. from bridge localStorage).
	 * Does NOT fire a save — the caller owns persistence. */
	setTapTimestamp(ms: number): void {
		if (!Number.isFinite(ms) || ms <= 0) return;
		state = { ...state, tapTimestamp: ms };
		notify();
	},

	/** Install the resolved death rate once the World Bank fetch completes. */
	setDeathsPerSec(deathsPerSec: number, source: AppState['rateSource']): void {
		if (!Number.isFinite(deathsPerSec) || deathsPerSec <= 0) return;
		state = { ...state, deathsPerSec, rateSource: source };
		notify();
	},
};

/** Compute deaths accrued since the last tap. */
export function deathsSinceTap(now: number = Date.now()): string {
	if (!state.tapTimestamp) return '--';
	const elapsedSec = Math.max(0, (now - state.tapTimestamp) / 1000);
	const tot = Math.floor(elapsedSec * state.deathsPerSec);
	return tot > MAX_DEATHS ? 'too much' : tot.toLocaleString('en-US');
}
