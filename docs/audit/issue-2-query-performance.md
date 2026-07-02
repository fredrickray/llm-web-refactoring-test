# Issue 2 Audit: Query Performance

## Anti-pattern: N+1 queries for post engagement counts

Feed, bookmarks, and posts services called `getPostCounts(postId)` **inside a loop** for each post — executing 2–3 SQL queries per post (like count, comment count, is-liked check).

## Profiled query counts (10 posts)

| Operation | Before | After |
|-----------|--------|-------|
| Home feed (10 posts) | **1** follow query + **1** posts query + **30** count queries = **32** | **1** + **1** + **3** batch = **5** |
| User profile page | **1** user + **3** counts + **1** follow check = **5** | **5** (already batched at profile level — no N+1) |
| Bookmarks page (10 posts) | **1** bookmark list + **10** post fetches + **30** counts = **41** | **1** + **1** batch posts + **3** batch counts = **5** |

Per-post breakdown (before): each post → 1 like COUNT + 1 comment COUNT + 1 optional is-liked SELECT = **3 queries × N posts**.

## Fix

Created `batchPostCounts()` and `attachPostCounts()` in `apps/api/src/services/post-counts.util.ts`:
- **1 query** for all like counts (GROUP BY post_id)
- **1 query** for all comment counts (GROUP BY post_id)
- **1 query** for requester's likes (WHERE post_id IN (...))

Applied to: `feed.service.ts`, `bookmarks.service.ts`, `posts.service.ts` (list endpoints).

## Prevention

Always use `batchPostCounts(postIds, userId)` when enriching **multiple** posts. Single-post lookups (`getPost`) may call it with a one-element array.
