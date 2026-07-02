import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { attachPostCounts, batchPostCounts } from "./post-counts.util";

const { posts, users, follows } = schema;

interface FeedOptions {
	limit?: number;
	offset?: number;
	userId?: string;
}

export async function getHomeFeed(userId: string, options: FeedOptions = {}) {
	const limit = options.limit || 20;
	const offset = options.offset || 0;

	const following = await db
		.select({ followingId: follows.followingId })
		.from(follows)
		.where(eq(follows.followerId, userId));

	const followingIds = following.map((f) => f.followingId);
	const userIds = [...followingIds, userId];

	if (userIds.length === 0) {
		return [];
	}

	const result = await db
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
		.where(inArray(posts.authorId, userIds))
		.orderBy(desc(posts.createdAt))
		.limit(limit)
		.offset(offset);

	const countsMap = await batchPostCounts(
		result.map((p) => p.id),
		userId,
	);
	return attachPostCounts(result, countsMap);
}

export async function getExploreFeed(options: FeedOptions = {}) {
	const limit = options.limit || 20;
	const offset = options.offset || 0;

	const result = await db
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
		.orderBy(desc(posts.createdAt))
		.limit(limit)
		.offset(offset);

	const countsMap = await batchPostCounts(
		result.map((p) => p.id),
		options.userId,
	);
	return attachPostCounts(result, countsMap);
}
