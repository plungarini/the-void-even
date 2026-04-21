// TEMP DEBUG WIDGET — remove before release
import { useRef, useState } from 'react';
import { clearDebugLogs, useDebugLogs, type DebugLogEntry } from './logs';

function formatDetails(details: unknown[]): string {
	return details
		.map((d, i) => {
			try {
				return `[Arg ${i + 1}] ${JSON.stringify(d, null, 2)}`;
			} catch {
				return `[Arg ${i + 1}] ${String(d)}`;
			}
		})
		.join('\n\n');
}

function logsToText(logs: DebugLogEntry[]): string {
	return logs
		.map((e) => {
			const time = new Date(e.ts).toLocaleTimeString('en-GB', { hour12: false });
			let line = `[${time}] ${e.level.toUpperCase()} ${e.msg}`;
			if (e.details && e.details.length > 0) {
				line += '\n' + formatDetails(e.details);
			}
			return line;
		})
		.join('\n\n');
}

export function DebugPanel() {
	const logs = useDebugLogs();
	const [open, setOpen] = useState(false);
	const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const errorCount = logs.filter((l) => l.level === 'error').length;
	const warnCount = logs.filter((l) => l.level === 'warn').length;

	const handleCopy = () => {
		const text = logsToText(logs);
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.position = 'fixed'; // Avoid scrolling
		textarea.style.opacity = '0';
		document.body.appendChild(textarea);
		textarea.select();
		try {
			const successful = document.execCommand('copy');
			if (successful) {
				alert('Logs copied (execCommand)');
			} else {
				console.error('Copy command was unsuccessful');
			}
		} catch (err) {
			console.error('execCommand copy failed', err);
		}
		document.body.removeChild(textarea);
	};

	return (
		<div className="dbg-root">
			<button
				type="button"
				className={`dbg-toggle ${errorCount > 0 ? 'dbg-toggle--error' : warnCount > 0 ? 'dbg-toggle--warn' : ''}`}
				onClick={() => setOpen((v) => !v)}
				aria-label="Toggle debug panel"
			>
				🐛 {logs.length}{errorCount > 0 ? ` (${errorCount}❌)` : ''}
			</button>

			{open && (
				<div className="dbg-panel">
					<div className="dbg-header">
						<span className="dbg-title">Debug Logs</span>
						<button type="button" className="dbg-clear" onClick={handleCopy} title="Copy logs">
							📋
						</button>
						<button type="button" className="dbg-clear" onClick={clearDebugLogs}>
							clear
						</button>
						<button type="button" className="dbg-close" onClick={() => setOpen(false)}>
							✕
						</button>
					</div>

					<div className="dbg-list" ref={listRef}>
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
											{formatDetails(entry.details)}
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
