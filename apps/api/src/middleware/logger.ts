import { getRequestContext, getTraceId } from "./request-context";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
	level: LogLevel;
	message: string;
	traceId: string;
	service?: string;
	method?: string;
	userId?: string;
	durationMs?: number;
	error?: { name: string; message: string; code?: string };
	[key: string]: unknown;
}

function writeLog(entry: LogEntry): void {
	const output = JSON.stringify({
		timestamp: new Date().toISOString(),
		...entry,
	});
	if (entry.level === "error") {
		console.error(output);
	} else if (entry.level === "warn") {
		console.warn(output);
	} else {
		console.log(output);
	}
}

export const logger = {
	info(message: string, extra: Record<string, unknown> = {}): void {
		const ctx = getRequestContext();
		writeLog({
			level: "info",
			message,
			traceId: getTraceId(),
			service: ctx?.service,
			method: ctx?.method,
			userId: ctx?.userId,
			...extra,
		});
	},

	warn(message: string, extra: Record<string, unknown> = {}): void {
		const ctx = getRequestContext();
		writeLog({
			level: "warn",
			message,
			traceId: getTraceId(),
			service: ctx?.service,
			method: ctx?.method,
			...extra,
		});
	},

	error(message: string, error: unknown, extra: Record<string, unknown> = {}): void {
		const ctx = getRequestContext();
		writeLog({
			level: "error",
			message,
			traceId: getTraceId(),
			service: ctx?.service,
			method: ctx?.method,
			error: {
				name: error instanceof Error ? error.name : "Error",
				message: error instanceof Error ? error.message : String(error),
				code: error instanceof Error && "code" in error ? String((error as any).code) : undefined,
			},
			...extra,
		});
	},
};
