import { useEffect, useState } from 'react';

export interface DebugLogEntry {
	level: 'log' | 'warn' | 'error';
	msg: string;
	ts: number;
	details?: unknown[];
}

declare global {
	var __refreshDebug: (() => void) | undefined;
	var __debugLogs: DebugLogEntry[] | undefined;
}

function cloneLogs(logs: DebugLogEntry[] | undefined): DebugLogEntry[] {
	return [...(logs || [])];
}

export function clearDebugLogs(): void {
	globalThis.__debugLogs = [];
	globalThis.__refreshDebug?.();
}

export function useDebugLogs(): DebugLogEntry[] {
	const [logs, setLogs] = useState<DebugLogEntry[]>(cloneLogs(globalThis.__debugLogs));

	useEffect(() => {
		const previousRefresh = globalThis.__refreshDebug;
		const handleRefresh = () => {
			setLogs(cloneLogs(globalThis.__debugLogs));
			previousRefresh?.();
		};

		globalThis.__refreshDebug = handleRefresh;

		return () => {
			if (globalThis.__refreshDebug === handleRefresh) {
				globalThis.__refreshDebug = previousRefresh;
			}
		};
	}, []);

	return logs;
}

export {};
