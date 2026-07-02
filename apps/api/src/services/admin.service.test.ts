import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "../../tests/helpers";
import { db, schema } from "../db";
import {
  banUser,
  deleteCommentAdmin,
  deletePostAdmin,
  getUserDetails,
  listUsers,
  updateUserRole,
} from "./admin.service";

const { users } = schema;

describe("AdminService", () => {
  it("lists users with aggregate counts", async () => {
    const admin = await createTestUser({ username: "admin", role: "admin" });
    const target = await createTestUser({ username: "target" });
    const postId = await createTestPost(target.id, "Admin list users post");
    await createTestComment(postId, target.id, "Admin list users comment");

    const result = await listUsers({ limit: 10 });

    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(
      result.users.some(
        (user) => user.id === admin.id && user.role === "admin",
      ),
    ).toBe(true);
    expect(
      result.users.some(
        (user) =>
          user.id === target.id &&
          user.postCount === 1 &&
          user.commentCount === 1,
      ),
    ).toBe(true);
  });

  it("returns user details and hides password hash", async () => {
    const user = await createTestUser({ username: "detail-user" });
    await createTestPost(user.id, "Detail post 1");
    const secondPostId = await createTestPost(user.id, "Detail post 2");
    await createTestComment(secondPostId, user.id, "Detail comment");

    const details = await getUserDetails(user.id);

    expect(details.id).toBe(user.id);
    expect((details as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(details.postCount).toBe(2);
    expect(details.commentCount).toBe(1);
  });

  it("rejects invalid admin actions", async () => {
    const admin = await createTestUser({
      username: "superadmin",
      role: "admin",
    });
    const target = await createTestUser({ username: "target-user" });
    const banTarget = await createTestUser({
      username: "ban-target",
      role: "admin",
    });
    const deletePostId = await createTestPost(target.id, "Admin action post");
    await createTestComment(deletePostId, target.id, "Admin action comment");

    await expect(
      updateUserRole(target.id, "not-a-role", admin.id),
    ).rejects.toThrow("Invalid role");
    await expect(banUser(banTarget.id, "policy", admin.id)).rejects.toThrow(
      "Cannot ban admin users",
    );
    await expect(
      deletePostAdmin("missing-post", "reason", admin.id),
    ).rejects.toThrow("Post not found");
    await expect(
      deleteCommentAdmin("missing-comment", "reason", admin.id),
    ).rejects.toThrow("Comment not found");
  });
});
