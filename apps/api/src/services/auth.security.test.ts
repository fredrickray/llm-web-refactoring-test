import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it } from "vitest";
import { db, schema } from "../db";
import { getJwtSecret, validateSessionToken } from "../middleware/auth";
import { loginUser, registerUser } from "./auth.service";
import {
	generateId,
	hashPassword,
	isLegacySha256Hash,
	legacySha256Hash,
	verifyPassword,
} from "./utils";

const { users } = schema;

describe("Credential Security", () => {
	describe("password hashing vulnerability (fixed)", () => {
		it("uses bcrypt for newly registered users, not fast SHA-256", async () => {
			const result = await registerUser({
				email: "bcrypt-new@example.com",
				username: "bcryptnew",
				displayName: "Bcrypt New",
				password: "password123",
			});

			const user = await db.select().from(users).where(eq(users.id, result.userId)).get();
			expect(user?.passwordHash).toBeDefined();
			expect(isLegacySha256Hash(user!.passwordHash)).toBe(false);
			expect(user!.passwordHash.startsWith("$2")).toBe(true);
		});

		it("proves legacy SHA-256 hashes were fast to compute (vulnerability existed)", () => {
			const start = performance.now();
			for (let i = 0; i < 10000; i++) {
				legacySha256Hash(`password${i}`);
			}
			const elapsed = performance.now() - start;
			// Legacy SHA-256: 10k hashes in well under 500ms — unsuitable for passwords
			expect(elapsed).toBeLessThan(500);
		});

		it("migrates legacy SHA-256 users on login without plaintext passwords", async () => {
			const id = generateId();
			const legacyHash = legacySha256Hash("password123");

			await db.insert(users).values({
				id,
				email: "legacy@example.com",
				username: "legacyuser",
				displayName: "Legacy User",
				passwordHash: legacyHash,
				role: "user",
			});

			expect(isLegacySha256Hash(legacyHash)).toBe(true);

			await loginUser({ email: "legacy@example.com", password: "password123" });

			const upgraded = await db.select().from(users).where(eq(users.id, id)).get();
			expect(isLegacySha256Hash(upgraded!.passwordHash)).toBe(false);
			expect(upgraded!.passwordHash.startsWith("$2")).toBe(true);

			// Can log in again with bcrypt hash
			const secondLogin = await loginUser({
				email: "legacy@example.com",
				password: "password123",
			});
			expect(secondLogin.sessionToken).toBeDefined();
		});

		it("rejects wrong password for legacy hash users", async () => {
			const id = generateId();
			await db.insert(users).values({
				id,
				email: "legacy-wrong@example.com",
				username: "legacywrong",
				displayName: "Legacy Wrong",
				passwordHash: legacySha256Hash("correct"),
				role: "user",
			});

			await expect(
				loginUser({ email: "legacy-wrong@example.com", password: "incorrect" }),
			).rejects.toThrow("Invalid email or password");
		});
	});

	describe("trust establishment vulnerability (fixed)", () => {
		const originalEnv = process.env.GRPC_JWT_SECRET;
		const originalNodeEnv = process.env.NODE_ENV;

		afterEach(() => {
			if (originalEnv === undefined) {
				delete process.env.GRPC_JWT_SECRET;
			} else {
				process.env.GRPC_JWT_SECRET = originalEnv;
			}
			process.env.NODE_ENV = originalNodeEnv;
		});

		it("rejects tokens signed with a forged secret (client re-signing attack)", () => {
			process.env.GRPC_JWT_SECRET = "real-api-secret-at-least-32-characters";

			const forgedToken = jwt.sign(
				{ userId: "attacker", username: "attacker", role: "admin" },
				"attacker-known-default-secret-key-32chars",
				{ expiresIn: 3600 },
			);

			expect(() => validateSessionToken(forgedToken)).toThrow("Invalid or expired session token");
		});

		it("requires GRPC_JWT_SECRET in production", () => {
			delete process.env.GRPC_JWT_SECRET;
			process.env.NODE_ENV = "production";

			expect(() => getJwtSecret()).toThrow("GRPC_JWT_SECRET environment variable is required");
		});

		it("accepts only API-issued tokens signed with the configured secret", async () => {
			process.env.GRPC_JWT_SECRET = "test-secret-for-api-signing-32chars";

			const result = await registerUser({
				email: "trust@example.com",
				username: "trustuser",
				displayName: "Trust User",
				password: "password123",
			});

			const auth = validateSessionToken(result.sessionToken);
			expect(auth.userId).toBe(result.userId);
			expect(auth.role).toBe("user");
		});
	});
});

describe("verifyPassword", () => {
	it("detects bcrypt hashes correctly", async () => {
		const hash = await hashPassword("test");
		const result = await verifyPassword("test", hash);
		expect(result.valid).toBe(true);
		expect(result.needsUpgrade).toBe(false);
	});
});
