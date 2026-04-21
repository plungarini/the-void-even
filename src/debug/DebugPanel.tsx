// TEMP DEBUG WIDGET — remove before release
import { useState } from 'react';
import { clearDebugLogs, useDebugLogs } from './logs';

export function DebugPanel() {
	const logs = useDebugLogs();
	const [open, setOpen] = useState(false);
	const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

	return (
		<div className="dbg-root">
			<button
				type="button"
				className="dbg-toggle"
				onClick={() => setOpen((v) => !v)}
				aria-label="Toggle debug panel"
			>
				🐛 {logs.length}
			</button>

			{open && (
				<div className="dbg-panel">
					<div className="dbg-header">
						<span className="dbg-title">Debug Logs</span>
						<button type="button" className="dbg-clear" onClick={clearDebugLogs}>
							clear
						</button>
						<button type="button" className="dbg-close" onClick={() => setOpen(false)}>
							✕
						</button>
					</div>

					<div className="dbg-list">
						{logs.length === 0 && <p className="dbg-empty">No logs yet.</p>}
						{[...logs].reverse().map((entry, i) => {
							const isExpanded = expandedIdx === i;
							const time = new Date(entry.ts).toLocaleTimeString('en-GB', { hour12: false });
							return (
								<button
									type="button"
									key={i}
									className={`dbg-entry dbg-entry--${entry.level}`}
									onClick={() => setExpandedIdx(isExpanded ? null : i)}
								>
									<span className="dbg-time">{time}</span>
									<span className="dbg-level">{entry.level}</span>
									<span className="dbg-msg">{entry.msg}</span>
									{isExpanded && entry.details && entry.details.length > 0 && (
										<pre className="dbg-detail">
											{entry.details.map((d, di) => (
												<span key={di}>{JSON.stringify(d, null, 2)}{'\n'}</span>
											))}
										</pre>
									)}
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
