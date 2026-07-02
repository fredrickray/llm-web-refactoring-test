import { describe, expect, it, vi } from "vitest";
import { ErrorCode, AppError, classifyError } from "../errors/app-error";
import { withTracing } from "../middleware/handler-wrapper";
import { getTraceId, runWithRequestContext } from "../middleware/request-context";

describe("Error Taxonomy", () => {
	it("classifies authentication errors", () => {
		const err = classifyError(new Error("Authentication required"));
		expect(err.code).toBe(ErrorCode.UNAUTHENTICATED);
		expect(err.grpcStatus).toBe(16);
	});

	it("classifies not found errors", () => {
		const err = classifyError(new Error("Post not found"));
		expect(err.code).toBe(ErrorCode.NOT_FOUND);
		expect(err.grpcStatus).toBe(5);
	});

	it("classifies permission errors", () => {
		const err = classifyError(new Error("Admin access required"));
		expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
		expect(err.grpcStatus).toBe(7);
	});

	it("preserves AppError instances", () => {
		const original = new AppError("Custom", ErrorCode.INVALID_ARGUMENT);
		expect(classifyError(original)).toBe(original);
	});
});

describe("Request Tracing", () => {
	it("propagates traceId through async context", async () => {
		await runWithRequestContext(
			{ traceId: "test-trace-123", service: "TestService", method: "test" },
			async () => {
				expect(getTraceId()).toBe("test-trace-123");
			},
		);
	});

	it("wraps handlers with tracing without changing response shape", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const handlers = withTracing("TestService", {
			async echo(request: { value: string }) {
				return { result: request.value };
			},
		});

		const response = await handlers.echo({ value: "hello" });
		expect(response).toEqual({ result: "hello" });

		const logs = logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
		expect(logs.some((l) => l.message === "grpc.request.start" && l.traceId)).toBe(true);
		expect(logs.some((l) => l.message === "grpc.request.success" && l.durationMs >= 0)).toBe(
			true,
		);

		logSpy.mockRestore();
	});

	it("logs errors with traceId and re-throws AppError", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const handlers = withTracing("TestService", {
			async fail() {
				throw new Error("Post not found");
			},
		});

		await expect(handlers.fail({})).rejects.toMatchObject({
			message: "Post not found",
			code: ErrorCode.NOT_FOUND,
		});

		const logs = errorSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
		expect(logs[0].traceId).toBeDefined();
		expect(logs[0].errorCode).toBe(ErrorCode.NOT_FOUND);

		errorSpy.mockRestore();
	});
});
