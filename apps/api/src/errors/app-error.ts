/**
 * Unified error taxonomy for the Chirp API.
 * Maps application errors to gRPC status codes without changing response contracts.
 */
export enum ErrorCode {
	UNAUTHENTICATED = "UNAUTHENTICATED",
	UNAUTHORIZED = "UNAUTHORIZED",
	NOT_FOUND = "NOT_FOUND",
	ALREADY_EXISTS = "ALREADY_EXISTS",
	INVALID_ARGUMENT = "INVALID_ARGUMENT",
	FAILED_PRECONDITION = "FAILED_PRECONDITION",
	INTERNAL = "INTERNAL",
}

const ERROR_CODE_TO_GRPC: Record<ErrorCode, number> = {
	[ErrorCode.UNAUTHENTICATED]: 16, // UNAUTHENTICATED
	[ErrorCode.UNAUTHORIZED]: 7, // PERMISSION_DENIED
	[ErrorCode.NOT_FOUND]: 5, // NOT_FOUND
	[ErrorCode.ALREADY_EXISTS]: 6, // ALREADY_EXISTS
	[ErrorCode.INVALID_ARGUMENT]: 3, // INVALID_ARGUMENT
	[ErrorCode.FAILED_PRECONDITION]: 9, // FAILED_PRECONDITION
	[ErrorCode.INTERNAL]: 13, // INTERNAL
};

/** Map common error message patterns to taxonomy codes. */
const MESSAGE_PATTERNS: Array<{ pattern: RegExp; code: ErrorCode }> = [
	{ pattern: /authentication required|invalid or expired session/i, code: ErrorCode.UNAUTHENTICATED },
	{ pattern: /admin access required|access denied|not the author|only edit|only delete/i, code: ErrorCode.UNAUTHORIZED },
	{ pattern: /not found/i, code: ErrorCode.NOT_FOUND },
	{ pattern: /already exists|already taken/i, code: ErrorCode.ALREADY_EXISTS },
	{ pattern: /invalid email|required|must be|too long|too short|expired|banned/i, code: ErrorCode.INVALID_ARGUMENT },
	{ pattern: /edit window/i, code: ErrorCode.FAILED_PRECONDITION },
];

export class AppError extends Error {
	readonly code: ErrorCode;
	readonly grpcStatus: number;
	readonly traceId?: string;

	constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL, traceId?: string) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.grpcStatus = ERROR_CODE_TO_GRPC[code];
		this.traceId = traceId;
	}
}

export function classifyError(error: unknown, traceId?: string): AppError {
	if (error instanceof AppError) {
		return error;
	}

	const message = error instanceof Error ? error.message : "Internal server error";

	for (const { pattern, code } of MESSAGE_PATTERNS) {
		if (pattern.test(message)) {
			return new AppError(message, code, traceId);
		}
	}

	return new AppError(message, ErrorCode.INTERNAL, traceId);
}

export function getGrpcStatusForError(error: unknown): number {
	return classifyError(error).grpcStatus;
}
