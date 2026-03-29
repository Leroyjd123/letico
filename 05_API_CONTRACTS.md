# lectio — api contracts

**Version:** 1.0  
**Base URL:** `https://api.lectio.app/api` (production) | `http://localhost:4000/api` (local)  
**Auth:** Bearer token (Supabase JWT) via `Authorization: Bearer <token>` header  
**Guest auth:** `X-Guest-Token: <guest_token>` header for unauthenticated users  
**Content-Type:** `application/json`  
**Last Updated:** 2026-03-28

---

## conventions

- All responses are JSON.
- Success responses wrap data in `{ "data": ... }`.
- Error responses use `{ "error": { "code": "...", "message": "..." } }`.
- All timestamps are ISO 8601 UTC strings.
- Verse IDs are integers (serial, 1-based). Never expose `global_order` in responses.
- Text fields: lowercase display is a UI concern, not an API concern. API returns natural case.

---

## 1. bible endpoints

### GET /bible/books

Returns all 66 Bible books in canonical order.

**auth:** None required.  
**cache:** 24 hours.

**response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "usfmCode": "GEN",
      "name": "Genesis",
      "testament": "OT",
      "chapterCount": 50
    },
    ...
  ]
}
```

---

### GET /bible/books/:usfmCode

Returns a single book. `usfmCode` is case-insensitive.

**auth:** None required.

**response 200:**
```json
{
  "data": {
    "id": 1,
    "usfmCode": "GEN",
    "name": "Genesis",
    "testament": "OT",
    "chapterCount": 50
  }
}
```

**response 404:**
```json
{ "error": { "code": "BOOK_NOT_FOUND", "message": "Book not found: XYZ" } }
```

---

### GET /bible/books/:usfmCode/chapters

Returns all chapters for a book.

**auth:** None required.  
**cache:** 24 hours.

**response 200:**
```json
{
  "data": [
    { "id": 1, "bookId": 1, "number": 1, "verseCount": 31 },
    { "id": 2, "bookId": 1, "number": 2, "verseCount": 25 },
    ...
  ]
}
```

---

### GET /bible/chapters/:chapterId/verses

Returns all verses for a chapter with text.

**auth:** None required.  
**cache:** 1 hour.

**response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "chapterId": 1,
      "number": 1,
      "text": "In the beginning God created the heaven and the earth."
    },
    ...
  ]
}
```

**response 404:**
```json
{ "error": { "code": "CHAPTER_NOT_FOUND", "message": "Chapter not found: 99999" } }
```

---

## 2. plan endpoints

### GET /plan/today

Returns today's plan day view for the authenticated user. "Today" is computed from `user.plan_start_date` and the current UTC date.

**auth:** Required (Bearer or X-Guest-Token).

**response 200:**
```json
{
  "data": {
    "dayNumber": 42,
    "label": "genesis 12–15",
    "book": "Genesis",
    "chapter": 12,
    "startVerse": 1,
    "endVerse": 20,
    "startVerseId": 322,
    "endVerseId": 341,
    "isToday": true,
    "offsetFromToday": 0
  }
}
```

**notes:**
- If `plan_start_date` is null, returns day 1.
- `startVerseId` and `endVerseId` are the verse table IDs (not global_order — that is internal).
- A plan day may span multiple chapters; `label` is a human-readable summary.

---

### GET /plan/:planId/day/:dayNumber

Returns any plan day by day number. Allows read-ahead and backfill navigation.

**auth:** Required.

**response 200:** Same shape as `/plan/today`.

**response 404:**
```json
{ "error": { "code": "PLAN_DAY_NOT_FOUND", "message": "Day 400 not found in plan" } }
```

---

### GET /plan/:planId/days

Returns a paginated list of plan days for the plan view screen. This endpoint exists because the plan view must render all 365 days — fetching them one-by-one via `/day/:dayNumber` would be 365 round trips.

**auth:** Required.
**query params:** `limit` (default 50, max 100), `offset` (default 0).

**response 200:**
```json
{
  "data": {
    "items": [
      {
        "dayNumber": 1,
        "label": "genesis 1–3",
        "startVerseId": 1,
        "endVerseId": 83,
        "isToday": false,
        "offsetFromToday": -41
      },
      ...
    ],
    "total": 365,
    "limit": 50,
    "offset": 0
  }
}
```

**notes:**

- `completionPct` is **not** included in this list response — it would require 50 DB calls per page. The plan view renders rows without completion % initially, then loads per-day completion via a separate mechanism (either lazy-loading per visible row or a bulk completion endpoint in a future phase).
- `offsetFromToday` is computed from `user.plan_start_date` and today's UTC date. Negative = past, 0 = today, positive = future.

---

## 3. progress endpoints

### POST /progress/verses

Batch marks verses as read. Idempotent — re-marking already-read verses is a no-op (upsert).

**auth:** Required (Bearer or X-Guest-Token).

**request body:**
```json
{
  "verseIds": [1, 2, 3, 4, 5]
}
```

**validation:**
- `verseIds`: array of integers, min 1 item, max 500 items.
- All verse IDs must exist in the verses table. Unknown IDs are silently ignored (no 400).

**response 200:**
```json
{
  "data": {
    "inserted": 3,
    "alreadyRead": 2
  }
}
```

**response 400 (empty array):**
```json
{ "error": { "code": "INVALID_INPUT", "message": "verseIds must contain at least 1 item" } }
```

---

### GET /progress/continue

Returns the next unread verse — the user's continue reading position. This is the verse with the lowest `global_order` that has no `verse_read` row for the current user.

**auth:** Required.

**response 200:**
```json
{
  "data": {
    "bookUsfm": "GEN",
    "bookName": "Genesis",
    "chapterNumber": 12,
    "verseNumber": 3,
    "verseId": 324
  }
}
```

**response 200 (all verses read):**
```json
{
  "data": null
}
```

**note:** A `null` data value means the user has read all 31,102 verses. The UI should show a special end-state message. This is not an error.

---

### GET /progress/summary

Returns the user's reading analytics.

**auth:** Required.

**response 200:**
```json
{
  "data": {
    "totalVersesRead": 9934,
    "completionPct": 31.97,
    "streakDays": 5,
    "aheadBehindVerses": 120
  }
}
```

**field notes:**
- `completionPct`: `totalVersesRead / 31102 * 100`, rounded to 2 decimal places.
- `streakDays`: consecutive UTC calendar days with ≥ 1 verse read, counting back from today. Note: uses UTC calendar days — see A6 in PRD for the known timezone edge case.
- `aheadBehindVerses`: `(verse_reads in plan_days 1–N) − (total verses in plan_days 1–N)`, where N = today's plan day number. Positive = ahead, negative = behind, 0 = on plan, null = no active plan. Both operands are derived from `verse_reads` and the plan definition — never stored.

---

## 4. auth endpoints

### POST /auth/guest

Creates a guest user and returns a guest token.

**auth:** None.

**response 200:**
```json
{
  "data": {
    "guestToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "createdAt": "2026-03-28T10:00:00Z"
  }
}
```

---

### POST /auth/otp/send

Sends an OTP to the provided email via Supabase Auth.

**auth:** None.

**request body:**
```json
{ "email": "user@example.com" }
```

**response 200:**
```json
{
  "data": { "sent": true }
}
```

**response 400 (invalid email):**
```json
{ "error": { "code": "INVALID_EMAIL", "message": "Please provide a valid email address" } }
```

---

### POST /auth/otp/verify

Verifies OTP and returns a session.

**auth:** None.

**request body:**
```json
{
  "email": "user@example.com",
  "token": "123456"
}
```

**response 200:**
```json
{
  "data": {
    "accessToken": "<supabase_jwt>",
    "user": {
      "id": "uuid",
      "email": "user@example.com"
    }
  }
}
```

**response 401 (invalid/expired OTP):**
```json
{ "error": { "code": "INVALID_OTP", "message": "The code is invalid or has expired. Please request a new one." } }
```

---

### POST /auth/migrate

Migrates all verse_reads from a guest user to an authenticated user. Called immediately after OTP verification if a `guestToken` exists in localStorage.

**auth:** Required (Bearer token from OTP verify).

**request body:**
```json
{ "guestToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
```

**response 200 (migration succeeded):**
```json
{
  "data": {
    "migratedReads": 147,
    "alreadyMigrated": false
  }
}
```

**response 200 (migration already complete — called from a second device):**
```json
{
  "data": {
    "migratedReads": 0,
    "alreadyMigrated": true
  }
}
```

This case occurs when the authenticated user already has `verse_reads` rows (migration succeeded on another device). The frontend must treat `alreadyMigrated: true` as a success and proceed normally — never show an error to the user.

**response 400 (token completely unknown or expired):**
```json
{ "error": { "code": "INVALID_GUEST_TOKEN", "message": "Unable to migrate. Please sign in fresh." } }
```

---

## 5. error codes reference

| code | http status | description |
|---|---|---|
| BOOK_NOT_FOUND | 404 | USFM code not found in books table |
| CHAPTER_NOT_FOUND | 404 | Chapter ID not found |
| PLAN_DAY_NOT_FOUND | 404 | Day number not in plan |
| INVALID_INPUT | 400 | Request body validation failure |
| INVALID_EMAIL | 400 | Email format invalid |
| INVALID_OTP | 401 | OTP expired or incorrect |
| INVALID_GUEST_TOKEN | 400 | Guest token not found or already used |
| UNAUTHORIZED | 401 | Missing or invalid Bearer token |
| INTERNAL_ERROR | 500 | Unexpected server error |

---

## 6. version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial draft |
