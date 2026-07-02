import { describe, expect, it, vi } from "vitest";
import { createTestFollow, createTestLike, createTestPost, createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import { getBookmarkedPosts, toggleBookmark } from "./bookmarks.service";
import { getHomeFeed } from "./feed.service";
import { batchPostCounts } from "./post-counts.util";
import { getUser } from "./users.service";

const { bookmarks } = schema;

describe("Query Performance", () => {
	it("batchPostCounts uses at most 3 queries regardless of post count", async () => {
		const user = await createTestUser();
		const postIds: string[] = [];
		for (let i = 0; i < 10; i++) {
			postIds.push(await createTestPost(user.id, `Post ${i}`));
		}

		let queryCount = 0;
		const originalSelect = db.select.bind(db);
		vi.spyOn(db, "select").mockImplementation((...args) => {
			queryCount++;
			return originalSelect(...args);
		});

		await batchPostCounts(postIds, user.id);

		expect(queryCount).toBeLessThanOrEqual(3);
		vi.restoreAllMocks();
	});

	it("home feed for 10 posts uses batch counts (not 30+ per-post queries)", async () => {
		const user = await createTestUser();
		const author = await createTestUser({ username: "author1" });
		await createTestFollow(user.id, author.id);

		for (let i = 0; i < 10; i++) {
			const postId = await createTestPost(author.id, `Feed post ${i}`);
			await createTestLike(user.id, postId);
		}

		let queryCount = 0;
		const originalSelect = db.select.bind(db);
		vi.spyOn(db, "select").mockImplementation((...args) => {
			queryCount++;
			return originalSelect(...args);
		});

		const feed = await getHomeFeed(user.id, { limit: 10, offset: 0 });
		expect(feed).toHaveLength(10);

		// Before fix: 32+ queries. After: follow(1) + posts(1) + batch counts(≤3) = ≤5
		expect(queryCount).toBeLessThanOrEqual(6);
		vi.restoreAllMocks();
	});

	it("bookmarks page for 10 posts uses batch fetching", async () => {
		const user = await createTestUser();
		for (let i = 0; i < 10; i++) {
			const postId = await createTestPost(user.id, `Bookmark ${i}`);
			await toggleBookmark(postId, user.id);
		}

		let queryCount = 0;
		const originalSelect = db.select.bind(db);
		vi.spyOn(db, "select").mockImplementation((...args) => {
			queryCount++;
			return originalSelect(...args);
		});

		const result = await getBookmarkedPosts(user.id, user.id, 10, 0);
		expect(result).toHaveLength(10);

		// Before fix: 41+. After: bookmark list(1) + posts batch(1) + counts(≤3) = ≤5
		expect(queryCount).toBeLessThanOrEqual(6);
		vi.restoreAllMocks();
	});

	it("user profile uses fixed query count (no N+1)", async () => {
		const user = await createTestUser({ username: "profileuser" });

		let queryCount = 0;
		const originalSelect = db.select.bind(db);
		vi.spyOn(db, "select").mockImplementation((...args) => {
			queryCount++;
			return originalSelect(...args);
		});

		await getUser("profileuser");

		// user(1) + follower count(1) + following count(1) + post count(1) = 4-5
		expect(queryCount).toBeLessThanOrEqual(5);
		vi.restoreAllMocks();
	});
});
