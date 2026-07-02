import { describe, expect, it } from "vitest";
import { createTestComment, createTestLike, createTestPost, createTestUser } from "../../tests/helpers";
import { searchPosts, searchUsers } from "./search.service";

describe("SearchService", () => {
	it("returns an empty array for blank queries", async () => {
		expect(await searchPosts("   ")).toEqual([]);
		expect(await searchUsers("")).toEqual([]);
	});

	it("searches posts and attaches counts", async () => {
		const author = await createTestUser({ username: "author" });
		const viewer = await createTestUser({ username: "viewer" });
		const postId = await createTestPost(author.id, "A searchable chirp about backend testing");
		await createTestComment(postId, viewer.id, "Nice post");
		await createTestLike(viewer.id, postId);

		const results = await searchPosts("searchable", viewer.id);
		expect(results).toHaveLength(1);
		expect(results[0].likeCount).toBe(1);
		expect(results[0].commentCount).toBe(1);
		expect(results[0].isLiked).toBe(true);
		expect(results[0].author.username).toBe("author");
	});

	it("searches users by username and display name", async () => {
		await createTestUser({ username: "backend-dev", displayName: "Backend Developer" });
		await createTestUser({ username: "frontend-dev", displayName: "Frontend Developer" });

		const users = await searchUsers("Backend");
		expect(users).toHaveLength(1);
		expect(users[0].username).toBe("backend-dev");
	});
});