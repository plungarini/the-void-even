/**
 * Resolves the current global deaths-per-second from the World Bank open
 * data API (no auth, no key). Combines the crude death rate per 1,000
 * people with world population to get a single figure.
 *
 * Cached in memory for 24h; falls back gracefully on any failure.
 */

import { FALLBACK_DEATHS_PER_SEC, appStore } from '../app/store';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const SECONDS_PER_YEAR = 31_557_600; // 365.25 * 86400

const DEATH_RATE_URL =
	'https://api.worldbank.org/v2/country/1W/indicator/SP.DYN.CDRT.IN?format=json&mrv=1';
const POPULATION_URL =
	'https://api.worldbank.org/v2/country/1W/indicator/SP.POP.TOTL?format=json&mrv=1';

let cached: { value: number; at: number } | null = null;

async function fetchWithTimeout(url: string): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

function extractLatestValue(payload: unknown): number | null {
	// World Bank responses are [meta, [{ value, date, ... }, ...]]
	if (!Array.isArray(payload) || payload.length < 2) return null;
	const rows = payload[1];
	if (!Array.isArray(rows)) return null;
	for (const row of rows) {
		const value = row?.value;
		if (typeof value === 'number' && Number.isFinite(value)) return value;
	}
	return null;
}

export async function resolveDeathsPerSec(): Promise<number> {
	if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

	try {
		const [ratePayload, popPayload] = await Promise.all([
			fetchWithTimeout(DEATH_RATE_URL),
			fetchWithTimeout(POPULATION_URL),
		]);
		const crudeRate = extractLatestValue(ratePayload); // deaths per 1,000/year
		const population = extractLatestValue(popPayload);
		if (crudeRate === null || population === null) {
			throw new Error('World Bank payload missing values');
		}
		const deathsPerSec = (crudeRate / 1000) * population / SECONDS_PER_YEAR;
		if (!Number.isFinite(deathsPerSec) || deathsPerSec <= 0) {
			throw new Error('Computed deaths/sec is invalid');
		}
		cached = { value: deathsPerSec, at: Date.now() };
		return deathsPerSec;
	} catch (error) {
		console.warn('[DeathRate] falling back to hardcoded rate:', error);
		return FALLBACK_DEATHS_PER_SEC;
	}
}

/** Kick off the fetch and push the result into the shared store once
 * resolved. Idempotent — safe to call multiple times. */
export function startDeathRateBootstrap(): void {
	void resolveDeathsPerSec().then((deathsPerSec) => {
		const source = deathsPerSec === FALLBACK_DEATHS_PER_SEC ? 'fallback' : 'worldbank';
		appStore.setDeathsPerSec(deathsPerSec, source);
	});
}
