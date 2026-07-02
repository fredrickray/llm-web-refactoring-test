import { classifyError } from "../errors/app-error";
import { logger } from "./logger";
import { createTraceId, getTraceId, runWithRequestContext } from "./request-context";

type HandlerFn = (request: any) => Promise<any>;

/**
 * Wraps a gRPC handler method with request tracing and structured logging.
 * Preserves existing response contracts — errors that were thrown stay thrown,
 * errors that were returned as { success: false } stay returned.
 */
export function withTracing<T extends Record<string, HandlerFn>>(
	serviceName: string,
	handlers: T,
): T {
	const wrapped = {} as T;

	for (const [methodName, handler] of Object.entries(handlers)) {
		(wrapped as any)[methodName] = async (request: unknown) => {
			const traceId = createTraceId();
			const start = performance.now();

			return runWithRequestContext({ traceId, service: serviceName, method: methodName }, async () => {
				logger.info("grpc.request.start", {
					hasSessionToken: !!(request as any)?.sessionToken,
				});

				try {
					const result = await handler(request);
					const durationMs = Math.round(performance.now() - start);
					logger.info("grpc.request.success", { durationMs });
					// Attach traceId for clients reading response metadata via trailing headers
					if (result && typeof result === "object") {
						Object.defineProperty(result, "__traceId", {
							value: getTraceId(),
							enumerable: false,
						});
					}
					return result;
				} catch (error) {
					const durationMs = Math.round(performance.now() - start);
					const appError = classifyError(error, traceId);
					logger.error("grpc.request.error", appError, {
						durationMs,
						grpcStatus: appError.grpcStatus,
						errorCode: appError.code,
					});
					throw appError;
				}
			});
		};
	}

	return wrapped;
}
