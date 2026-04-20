import { useEffect, useState, useSyncExternalStore } from 'react';
import { appStore, deathsSinceTap } from './app/store';

function useStore() {
	return useSyncExternalStore(appStore.subscribe, appStore.getState, appStore.getState);
}

function formatElapsed(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App() {
	const state = useStore();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const elapsedMs = state.tapTimestamp ? now - state.tapTimestamp : 0;
	const deaths = deathsSinceTap(now);

	return (
		<main className="void-shell">
			<p className="void-title">The Void</p>
			{state.tapTimestamp && <p className="void-elapsed">Since your last tap · {formatElapsed(elapsedMs)}</p>}
			<p className="void-count">{deaths}</p>
			<p className="void-caption">
				souls have entered the void.
				<br />
				Memento mori.
			</p>
			<button className="void-tap" type="button" onClick={() => appStore.tap()}>
				Tap to reset
			</button>
			<p className="void-source">
				rate · {state.rateSource === 'worldbank' ? 'world bank open data' : 'cached fallback'}
			</p>
		</main>
	);
}
