import type { GrpcSessionPayload } from "@chirp/shared-types";
import jwt from "jsonwebtoken";

const DEV_JWT_SECRET = "chirp-grpc-jwt-secret-key-at-least-32-chars";

/**
 * Returns the JWT secret, requiring an env var in production.
 */
export function getJwtSecret(): string {
	const secret = process.env.GRPC_JWT_SECRET;
	if (secret) {
		return secret;
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("GRPC_JWT_SECRET environment variable is required in production");
	}
	return DEV_JWT_SECRET;
}

export interface AuthContext {
	userId: string;
	username: string;
	role: "user" | "admin" | "moderator";
}

/**
 * Validates a session token and returns the auth context
 */
export function validateSessionToken(token: string): AuthContext {
	try {
		const decoded = jwt.verify(token, getJwtSecret()) as GrpcSessionPayload;
		return {
			userId: decoded.userId,
			username: decoded.username,
			role: decoded.role,
		};
	} catch {
		throw new Error("Invalid or expired session token");
	}
}

/**
 * Creates a session token from auth context — only the API should call this.
 */
export function createSessionToken(
	context: AuthContext,
	expiresInSeconds: number = 7 * 24 * 60 * 60,
): string {
	return jwt.sign(
		{
			userId: context.userId,
			username: context.username,
			role: context.role,
		},
		getJwtSecret(),
		{ expiresIn: expiresInSeconds },
	);
}

/**
 * Requires authentication - throws if token is invalid
 */
export function requireAuth(token: string | undefined): AuthContext {
	if (!token) {
		throw new Error("Authentication required");
	}
	return validateSessionToken(token);
}

/**
 * Requires admin or moderator role
 */
export function requireAdmin(context: AuthContext): void {
	if (context.role !== "admin" && context.role !== "moderator") {
		throw new Error("Admin access required");
	}
}

/**
 * Requires admin role specifically
 */
export function requireSuperAdmin(context: AuthContext): void {
	if (context.role !== "admin") {
		throw new Error("Super admin access required");
	}
}
