import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestComment, createTestPost, createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import {
	createNotification,
	deleteNotification,
	getUnreadCount,
	getUserNotifications,
	markAllAsRead,
	markAsRead,
} from "./notifications.service";

const { notifications } = schema;

describe("NotificationsService", () => {
	it("skips self-notifications", async () => {
		const user = await createTestUser();

		const result = await createNotification({
			userId: user.id,
			actorId: user.id,
			type: "follow",
		});

		expect(result).toBeNull();
		expect(await db.select().from(notifications).get()).toBeUndefined();
	});

	it("enriches notifications with post and comment previews", async () => {
		const recipient = await createTestUser({ username: "recipient" });
		const actor = await createTestUser({ username: "actor" });
		const postId = await createTestPost(actor.id, "A post that should appear in notification previews");
		const commentId = await createTestComment(postId, actor.id, "A comment that should also appear in previews");

		await createNotification({
			userId: recipient.id,
			actorId: actor.id,
			type: "comment",
			postId,
			commentId,
		});

		const notificationsList = await getUserNotifications(recipient.id, 20, 0);

		expect(notificationsList).toHaveLength(1);
		expect(notificationsList[0].actor?.username).toBe("actor");
		expect(notificationsList[0].postContent).toContain("A post that should appear");
		expect(notificationsList[0].commentContent).toContain("A comment that should also appear");
	});

	it("tracks unread counts and supports read state changes", async () => {
		const recipient = await createTestUser({ username: "reader" });
		const actor = await createTestUser({ username: "notifier" });
		const postId = await createTestPost(actor.id, "Notification count post");

		await createNotification({ userId: recipient.id, actorId: actor.id, type: "like", postId });

		const unreadBefore = await getUnreadCount(recipient.id);
		expect(unreadBefore.count).toBe(1);

		const notification = await db
			.select()
			.from(notifications)
			.where(and(eq(notifications.userId, recipient.id), eq(notifications.postId, postId)))
			.get();

		expect(notification).toBeDefined();

		await expect(markAsRead(notification!.id, actor.id)).rejects.toThrow("Unauthorized");
		await expect(markAsRead("missing-notification", recipient.id)).rejects.toThrow("Notification not found");

		await markAsRead(notification!.id, recipient.id);
		expect((await getUnreadCount(recipient.id)).count).toBe(0);

		await createNotification({ userId: recipient.id, actorId: actor.id, type: "comment", postId });
		await markAllAsRead(recipient.id);
		expect((await getUnreadCount(recipient.id)).count).toBe(0);
	});

	it("deletes notifications with ownership checks", async () => {
		const recipient = await createTestUser({ username: "deleter" });
		const actor = await createTestUser({ username: "creator" });
		const postId = await createTestPost(actor.id, "Notification delete post");

		await createNotification({ userId: recipient.id, actorId: actor.id, type: "follow", postId });

		const notification = await db.select().from(notifications).where(eq(notifications.userId, recipient.id)).get();
		expect(notification).toBeDefined();

		await expect(deleteNotification(notification!.id, actor.id)).rejects.toThrow("Unauthorized");
		await deleteNotification(notification!.id, recipient.id);
		expect(await db.select().from(notifications).where(eq(notifications.id, notification!.id)).get()).toBeUndefined();
	});
});