import { describe, expect, it } from "vitest";
import { createTestPost, createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import { extractMentions, processMentions, validateMentionedUsers } from "./mentions.service";

const { notifications } = schema;

describe("MentionsService", () => {
	it("extracts unique mentions from content", () => {
		expect(extractMentions("Hi @alice and @bob, then @alice again")).toEqual(["alice", "bob"]);
	});

	it("validates known usernames only", async () => {
		const alice = await createTestUser({ username: "alice" });
		await createTestUser({ username: "bob" });

		const map = await validateMentionedUsers(["alice", "missing", "bob"]);

		expect(map.get("alice")).toBe(alice.id);
		expect(map.has("missing")).toBe(false);
		expect(map.size).toBe(2);
	});

	it("creates notifications for valid mentions and skips self-mentions", async () => {
		const author = await createTestUser({ username: "author" });
		const bob = await createTestUser({ username: "bob" });
		const carol = await createTestUser({ username: "carol" });
		const postId = await createTestPost(author.id, "Hello @author @bob @carol @bob");

		await processMentions("Hello @author @bob @carol @bob", author.id, postId);

		const rows = await db.select().from(notifications);
		expect(rows).toHaveLength(2);
		expect(rows.some((row) => row.userId === author.id)).toBe(false);
		expect(rows.some((row) => row.userId === bob.id)).toBe(true);
		expect(rows.some((row) => row.userId === carol.id)).toBe(true);
	});
});