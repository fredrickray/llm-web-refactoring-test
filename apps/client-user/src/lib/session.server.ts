import { useSession } from "@tanstack/react-start/server";

export interface SessionData {
	userId: string;
	username: string;
	/** API-issued JWT from login/register — never re-signed by the BFF */
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
	return "chirp-session-secret-key-at-least-32-chars";
}

export function useAppSession() {
	return useSession<SessionData>({
		password: getSessionSecret(),
		name: "chirp-session",
		cookie: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 7, // 7 days
		},
	});
}

export async function getSessionData(): Promise<SessionData | null> {
	const session = await useAppSession();
	if (!session.data.userId || !session.data.sessionToken) {
		return null;
	}
	return session.data as SessionData;
}

export async function setSessionData(data: SessionData): Promise<void> {
	const session = await useAppSession();
	await session.update(data);
}

export async function clearSessionData(): Promise<void> {
	const session = await useAppSession();
	await session.clear();
}

export async function requireAuth(): Promise<SessionData> {
	const session = await getSessionData();
	if (!session) {
		throw new Error("Unauthorized");
	}
	return session;
}
