import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
	traceId: string;
	service: string;
	method: string;
	userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
	return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
	return storage.getStore();
}

export function getTraceId(): string {
	return storage.getStore()?.traceId ?? "no-trace";
}

export function createTraceId(): string {
	return randomUUID();
}

export const TRACE_ID_METADATA_KEY = "x-trace-id";
