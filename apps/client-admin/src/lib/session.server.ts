import { useSession } from "@tanstack/react-start/server";

export interface AdminSessionData {
	userId: string;
	username: string;
	role: "admin" | "moderator";
	/** API-issued JWT from login — never re-signed by the BFF */
	sessionToken: string;
}

function getSessionSecret(): string {
	const secret = process.env.SESSION_SECRET;
	if (secret) {
		return secret;
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("SESSION_SECRET environment variable is required in production");
	}
	return "chirp-admin-session-secret-key-at-least-32-chars";
}

export function useAdminSession() {
	return useSession<AdminSessionData>({
		password: getSessionSecret(),
		name: "chirp-admin-session",
		cookie: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 8, // 8 hours (shorter for admin)
		},
	});
}

export async function getAdminSessionData(): Promise<AdminSessionData | null> {
	const session = await useAdminSession();
	if (!session.data.userId || !session.data.role || !session.data.sessionToken) {
		return null;
	}
	if (session.data.role !== "admin" && session.data.role !== "moderator") {
		return null;
	}
	return session.data as AdminSessionData;
}

export async function setAdminSessionData(data: AdminSessionData): Promise<void> {
	const session = await useAdminSession();
	await session.update(data);
}

export async function clearAdminSessionData(): Promise<void> {
	const session = await useAdminSession();
	await session.clear();
}

export async function requireAdminAuth(): Promise<AdminSessionData> {
	const session = await getAdminSessionData();
	if (!session) {
		throw new Error("Admin access required");
	}
	return session;
}
