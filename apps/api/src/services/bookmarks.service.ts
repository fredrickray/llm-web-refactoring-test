import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { generateId } from "./utils";
import { attachPostCounts, batchPostCounts } from "./post-counts.util";

const { bookmarks, posts, users } = schema;

/**
 * Toggle bookmark for a post (create if not exists, delete if exists)
 */
export async function toggleBookmark(postId: string, userId: string) {
	const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

	if (!post) {
		throw new Error("Post not found");
	}

	const existingBookmark = await db
		.select()
		.from(bookmarks)
		.where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, userId)))
		.get();

	if (existingBookmark) {
		await db.delete(bookmarks).where(eq(bookmarks.id, existingBookmark.id));
		return { bookmarked: false };
	}

	await db.insert(bookmarks).values({
		id: generateId(),
		postId,
		userId,
	});
	return { bookmarked: true };
}

/**
 * Get bookmark status for a single post
 */
export async function getBookmarkStatus(postId: string, userId: string) {
	const bookmark = await db
		.select()
		.from(bookmarks)
		.where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, userId)))
		.get();

	return { bookmarked: !!bookmark };
}

/**
 * Get all bookmarked posts for a user with pagination
 */
export async function getBookmarkedPosts(
	userId: string,
	requesterId?: string,
	limit = 20,
	offset = 0,
) {
	const bookmarkedPosts = await db
		.select({
			postId: bookmarks.postId,
			bookmarkedAt: bookmarks.createdAt,
		})
		.from(bookmarks)
		.where(eq(bookmarks.userId, userId))
		.orderBy(desc(bookmarks.createdAt))
		.limit(limit)
		.offset(offset);

	if (bookmarkedPosts.length === 0) {
		return [];
	}

	const postIds = bookmarkedPosts.map((b) => b.postId);

	const postRows = await db
		.select({
			id: posts.id,
			content: posts.content,
			createdAt: posts.createdAt,
			updatedAt: posts.updatedAt,
			author: {
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				avatarUrl: users.avatarUrl,
			},
		})
		.from(posts)
		.leftJoin(users, eq(posts.authorId, users.id))
		.where(inArray(posts.id, postIds));

	const postMap = new Map(postRows.map((p) => [p.id, p]));
	const countsMap = await batchPostCounts(postIds, requesterId);

	return bookmarkedPosts
		.map((bookmark) => {
			const post = postMap.get(bookmark.postId);
			if (!post) return null;
			return {
				...post,
				...countsMap.get(post.id)!,
			};
		})
		.filter((p) => p !== null);
}
