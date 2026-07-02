import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";

const { likes, comments } = schema;

export interface PostCounts {
	likeCount: number;
	commentCount: number;
	isLiked: boolean;
}

/**
 * Batch-fetch like/comment counts for multiple posts in 2-3 queries instead of 3N.
 * Use this instead of per-post count queries to avoid N+1 anti-pattern.
 */
export async function batchPostCounts(
	postIds: string[],
	userId?: string,
): Promise<Map<string, PostCounts>> {
	const counts = new Map<string, PostCounts>();

	if (postIds.length === 0) {
		return counts;
	}

	for (const id of postIds) {
		counts.set(id, { likeCount: 0, commentCount: 0, isLiked: false });
	}

	const likeCounts = await db
		.select({ postId: likes.postId, count: sql<number>`count(*)` })
		.from(likes)
		.where(inArray(likes.postId, postIds))
		.groupBy(likes.postId);

	for (const row of likeCounts) {
		if (row.postId) {
			const entry = counts.get(row.postId)!;
			entry.likeCount = row.count || 0;
		}
	}

	const commentCounts = await db
		.select({ postId: comments.postId, count: sql<number>`count(*)` })
		.from(comments)
		.where(inArray(comments.postId, postIds))
		.groupBy(comments.postId);

	for (const row of commentCounts) {
		if (row.postId) {
			const entry = counts.get(row.postId)!;
			entry.commentCount = row.count || 0;
		}
	}

	if (userId) {
		const userLikes = await db
			.select({ postId: likes.postId })
			.from(likes)
			.where(and(inArray(likes.postId, postIds), eq(likes.userId, userId)));

		for (const row of userLikes) {
			if (row.postId) {
				counts.get(row.postId)!.isLiked = true;
			}
		}
	}

	return counts;
}

/** Attach batch-fetched counts to an array of posts. */
export function attachPostCounts<T extends { id: string }>(
	posts: T[],
	countsMap: Map<string, PostCounts>,
): Array<T & PostCounts> {
	return posts.map((post) => ({
		...post,
		...countsMap.get(post.id)!,
	}));
}
