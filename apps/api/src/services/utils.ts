import { createHash } from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_COST = process.env.VITEST ? 4 : 12;
const LEGACY_SALT = "salt";

/**
 * Generate a simple ID
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Legacy SHA-256 hash — retained only for verifying and migrating existing users.
 * @deprecated Vulnerable to brute-force; do not use for new passwords.
 */
export function legacySha256Hash(password: string): string {
	const hash = createHash("sha256");
	hash.update(password + LEGACY_SALT);
	return hash.digest("hex");
}

/** Detect legacy SHA-256 hashes (64 hex chars, no bcrypt prefix). */
export function isLegacySha256Hash(hashedPassword: string): boolean {
	return /^[a-f0-9]{64}$/i.test(hashedPassword);
}

/**
 * Hash password using bcrypt (secure, adaptive cost).
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verify password against hash. Supports legacy SHA-256 (with upgrade flag) and bcrypt.
 */
export async function verifyPassword(
	password: string,
	hashedPassword: string,
): Promise<{ valid: boolean; needsUpgrade: boolean }> {
	if (isLegacySha256Hash(hashedPassword)) {
		const legacyHash = legacySha256Hash(password);
		return {
			valid: legacyHash === hashedPassword,
			needsUpgrade: legacyHash === hashedPassword,
		};
	}

	const valid = await bcrypt.compare(password, hashedPassword);
	return { valid, needsUpgrade: false };
}

/**
 * Convert Date to protobuf Timestamp
 */
export function toProtoTimestamp(date: Date): { seconds: bigint; nanos: number } {
	const ms = date.getTime();
	return {
		seconds: BigInt(Math.floor(ms / 1000)),
		nanos: (ms % 1000) * 1000000,
	};
}

/**
 * Convert protobuf Timestamp to Date
 */
export function fromProtoTimestamp(timestamp: { seconds: bigint; nanos: number }): Date {
	return new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1000000);
}
