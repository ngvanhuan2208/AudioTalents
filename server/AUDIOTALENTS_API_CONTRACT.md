# AudioTalents API Contract

Phase 2.6.2 contract audit. Backend remains in-memory; MongoDB migration is deferred.

## Conventions

Base URL: `http://localhost:5000/api`

Success:

```json
{"success":true,"message":"...","data":{}}
```

Paginated success:

```json
{"success":true,"message":"...","data":{"items":[],"pagination":{"page":1,"limit":20,"total":0,"totalPages":0}}}
```

Error:

```json
{"success":false,"error":{"code":"...","message":"...","details":{}}}
```

`401` means missing/invalid authentication. `403` means an authenticated user lacks permission. `404` hides inaccessible private resources as not found. `409` is a conflict. `422` is validation. `429` is rate limiting. `500` is an internal error.

## Authentication

OTP policy: 6-digit code, 5 minute expiry, 60 second resend cooldown, 5 verification attempts. OTP is hashed at rest, single-use, and never returned in API responses.

Rate limits: `/auth/register`, `/auth/login`, `/auth/forgot-password` use `authLimiter` (20 / 15 minutes). `/auth/verify-email`, `/auth/resend-verification`, `/auth/reset-password` use `otpLimiter` (5 / 15 minutes).

| Method | Path | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{username, email, password}` | `201` user with `role=USER`, `authorStatus=NONE`, `emailVerified=false`, `accountStatus=ACTIVE`, plus `emailVerificationRequired` and `verificationExpiresAt`. No tokens. If the email belongs to an unverified user, the existing pending account is returned and its active OTP is retained during cooldown or reissued after cooldown. Privilege fields in the body are ignored. | `409 EMAIL_ALREADY_REGISTERED` (verified email), `422 VALIDATION_ERROR`, `429 TOO_MANY_REQUESTS`, `503 SMTP_NOT_CONFIGURED` |
| POST | `/auth/verify-email` | Public | `{email, otp}` | `200` `{user}` with `emailVerified=true` | `400 INVALID_OTP`, `400 OTP_EXPIRED`, `400 OTP_ALREADY_USED`, `429 OTP_MAX_ATTEMPTS`, `429 TOO_MANY_REQUESTS` |
| POST | `/auth/resend-verification` | Public | `{email}` | `200` `{sent:true, expiresAt?}`. Unknown emails still return success. | `409 EMAIL_ALREADY_VERIFIED`, `429 OTP_RESEND_COOLDOWN`, `429 TOO_MANY_REQUESTS`, `503 SMTP_NOT_CONFIGURED` |
| POST | `/auth/login` | Public | `{email, password}` | `200` `{user, accessToken, refreshToken}` when verified and `ACTIVE` | `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED`, `403 ACCOUNT_SUSPENDED`, `403 ACCOUNT_DEACTIVATED`, `429 TOO_MANY_REQUESTS` |
| POST | `/auth/refresh` | Public | `{refreshToken}` | `200` `{accessToken}` | `401 UNAUTHORIZED` |
| POST | `/auth/logout` | Authenticated | — | `200`. Client-side token discard in this in-memory phase. | `401 UNAUTHORIZED` |
| GET | `/auth/me` | Authenticated | — | `200` `{user}` without `passwordHash` | `401 UNAUTHORIZED`, `403 EMAIL_NOT_VERIFIED` |
| POST | `/auth/forgot-password` | Public | `{email}` | `200` `{sent:true}` with a generic message whether or not the email exists | `422 VALIDATION_ERROR`, `429 TOO_MANY_REQUESTS` |
| PATCH | `/users/me` | Authenticated | profile fields | Role, author status, emailVerified, and account status cannot be escalated by request data. | `401`, `422` |
| POST | `/auth/reset-password` | Public | `{email, otp, password}` | `200` `{reset:true}`; increments `tokenVersion` so previous JWTs fail | `400 INVALID_OTP`, `400 OTP_EXPIRED`, `400 OTP_ALREADY_USED`, `422 VALIDATION_ERROR`, `429 OTP_MAX_ATTEMPTS` |

Password minimum length is 8 characters (`VALIDATION_ERROR`). Confirm-password matching is a frontend rule (`PASSWORD_MISMATCH` is not a backend code). `PASSWORD_TOO_WEAK` is represented by `VALIDATION_ERROR`.

GET `/users/me` remains the profile alias for the authenticated current user.

## Author Applications

| Method | Path | Auth | Permission | Request / rule |
|---|---|---|---|---|
| POST | `/author-applications` | Authenticated + verified email | Normal user | `displayName`, `bio`, `copyrightAgreement=true`; moves user to `PENDING`. Unverified users receive `403 EMAIL_NOT_VERIFIED`. |
| GET | `/author-applications/me` | Authenticated | Current user | Returns the caller's application. |
| GET | `/author-applications/admin` | Authenticated | Admin | Lists pending applications. |
| GET | `/author-applications/admin/:id` | Authenticated | Admin | Reads an application. |
| PATCH | `/author-applications/admin/:id/approve` | Authenticated | Admin | Sets application and user `authorStatus=APPROVED`; role remains `USER`. |
| PATCH | `/author-applications/admin/:id/reject` | Authenticated | Admin | Requires `reviewNote`; sets `authorStatus=REJECTED`. |

Application flow: `USER -> PENDING -> APPROVED|REJECTED`. Suspended users cannot create content.

## Stories

Public reads return only `visibility=PUBLIC` and `reviewStatus=APPROVED`.

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/stories` | Public | Public stories; authenticated owners/admins also see their private stories. |
| GET | `/stories/:slug` | Public/optional | Public story, or owner/admin for private story. |
| GET | `/stories/id/:id` | Public/optional | Same visibility rule as slug lookup. |
| GET | `/stories/trending` | Public/optional | Current story list contract. |
| GET | `/stories/new` | Public/optional | Current story list contract. |
| GET | `/stories/top-rated` | Public/optional | Current story list contract. |
| GET | `/stories/completed` | Public/optional | Current story list contract. |
| GET | `/stories/recommended` | Public/optional | Current story list contract. |
| GET | `/stories/author/stories` | Authenticated | Approved author or admin; owner content. |
| POST | `/stories/author/stories` | Authenticated | Approved author or admin; creates draft. |
| PATCH | `/stories/author/stories/:id` | Authenticated | Owner or admin. |
| DELETE | `/stories/author/stories/:id` | Authenticated | Owner or admin. |
| POST | `/stories/author/stories/:id/submit` | Authenticated | Owner or admin; moves review status to `PENDING_REVIEW`. |
| POST | `/stories` | Authenticated | Approved author or admin; compatibility alias for create. |
| PATCH | `/stories/:id` | Authenticated | Owner or admin. |
| DELETE | `/stories/:id` | Authenticated | Owner or admin. |
| POST | `/stories/:id/submit` | Authenticated | Owner or admin. |

Slugs are normalized and made unique before persistence. Future MongoDB migration should add a unique index on `slug`.

## Chapters

A public chapter list is available without authentication only when its parent story is public/approved. It returns only `APPROVED` or `PUBLISHED` chapters.

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/stories/:storyId/chapters` | Public/optional | Public approved chapters; owner/admin sees all chapters. |
| GET | `/chapters/:id` | Public/optional | Public approved/published chapter, or owner/admin. |
| POST | `/stories/:storyId/chapters` | Authenticated | Approved author/admin and story owner. |
| PATCH | `/chapters/:id` | Authenticated | Approved author/admin and story owner. |
| DELETE | `/chapters/:id` | Authenticated | Approved author/admin and story owner. |
| POST | `/chapters/:id/publish` | Authenticated | Owner/admin; moves chapter to `PENDING_REVIEW`. |
| PATCH | `/chapters/:id/moderate` | Authenticated | Admin; `APPROVED`, `REJECTED`, or `REVISION_REQUIRED`. |

`storyId + chapterNumber` is unique and should become a compound MongoDB unique index.

## Audio

Public audio is returned only when the parent story is public/approved, the chapter is approved/published, and the audio status is `APPROVED`. Rejected/draft assets are never public.

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/chapters/:chapterId/audio` | Public/optional | Approved public audio only. |
| GET | `/audio?chapterId=:id` | Authenticated | Admin sees all; non-admin sees own audio only. |
| GET | `/audio?chapterId=:id&deleted=true` | Authenticated | Approved owner or admin lists only soft-deleted audio for that chapter. The default list remains active audio only. |
| POST | `/audio` | Authenticated | Approved author/admin; owns the chapter. Requires `chapterId`, `audioUrl`. |
| PATCH | `/audio/:id` | Authenticated | Owner or admin. |
| DELETE | `/audio/:id` | Authenticated | Owner or admin. |
| POST | `/audio/:id/submit` | Authenticated | Owner or admin; moves audio to `PENDING_REVIEW`. |

## Genres and Search

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/genres` | Public | Lists genres. |
| GET | `/genres/:slug` | Public | Reads a genre. |
| POST | `/genres` | Authenticated | Admin only. |
| GET | `/search?q=:term` | Public/optional | Searches public stories. Supports `keyword`, `genre`, `author`, `status`, `sort`, `page`, `limit`. |

## Library, Favorites, History, Playlists

All endpoints below require authentication and scope data by `req.user.id`.

| Method | Path | Permission |
|---|---|---|
| GET | `/library` | Current user's library. |
| POST | `/library/:storyId` | Add for current user. |
| DELETE | `/library/:storyId` | Remove for current user. |
| GET | `/library/favorites` | Current user's favorites. |
| POST/DELETE | `/library/favorites/:storyId` | Toggle current user's favorite. |
| GET | `/library/history` | Current user's history. |
| DELETE | `/library/history/:id` | Own history item only. |
| GET | `/library/progress` | Current user's progress. |
| POST | `/library/progress` | Current user's progress; requires `storyId`, `chapterId`, `positionSeconds`. |
| GET | `/playlists` | Current user's playlists. |
| POST | `/playlists` | Creates current user's playlist. |
| PATCH/DELETE | `/playlists/:id` | Own playlist only. |
| POST/DELETE | `/playlists/:id/stories/:storyId` | Own playlist only. |

## Notifications

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Current user's notifications only. |
| PATCH | `/notifications/:id/read` | Authenticated | Own notification only. |
| PATCH | `/notifications/read-all` | Authenticated | Current user's notifications. |

## Comments and Ratings

| Method | Path | Auth | Permission |
|---|---|---|---|
| GET | `/stories/:id/comments` | Public | Public comments for a story. |
| POST | `/stories/:id/comments` | Authenticated | Creates a comment as current user. |
| DELETE | `/comments/:id` | Authenticated | Own comment or admin. |
| GET | `/stories/:id/rating` | Public | Returns `{count, average}`. |
| POST | `/stories/:id/rating` | Authenticated | Value must be integer `1..5`; one rating per user/story. |
| POST | `/chapters/:id/reports` | Authenticated | Creates a chapter report. |

## Admin Moderation and Audit Log

Admin-only routes:

- `GET /admin/content/pending`
- `PATCH /admin/stories/:id/approve|reject|revision`
- `PATCH /admin/chapters/:id/approve|reject|revision`
- `PATCH /admin/audio/:id/approve|reject|revision`
- `GET/PATCH /admin/author-applications...`

Moderation states:

- Story: lifecycle `DRAFT|ONGOING|COMPLETED|PAUSED`; review `DRAFT|PENDING_REVIEW|APPROVED|REJECTED|REVISION_REQUIRED`.
- Chapter: `DRAFT|PENDING_REVIEW|APPROVED|PUBLISHED|REJECTED|REVISION_REQUIRED|HIDDEN`.
- Audio: review `DRAFT|PENDING_REVIEW|APPROVED|REJECTED|REVISION_REQUIRED`; processing is separate (`UPLOADING|PROCESSING|READY|FAILED|ARCHIVED`).

Audit actions include `AUTHOR_APPLICATION_APPROVED`, `AUTHOR_APPLICATION_REJECTED`, `STORY_APPROVED`, `STORY_REJECTED`, `STORY_REVISION_REQUIRED`, `CHAPTER_APPROVED`, `CHAPTER_REJECTED`, `CHAPTER_REVISION_REQUIRED`, `AUDIO_APPROVED`, `AUDIO_REJECTED`, and `AUDIO_REVISION_REQUIRED`.

Each audit record carries `actorId`, `action`, `targetType`, `targetId`, `timestamp`, and `metadata`.

## MongoDB Preparation

No MongoDB or Mongoose is introduced in this phase.

Entities and relationships:

- `User -> AuthorApplication`
- `User -> OtpToken` (`EMAIL_VERIFICATION`, `PASSWORD_RESET`)
- `User -> Story`
- `Story -> Chapter -> Audio`
- `User -> Library/Favorite/History/Playlist/Notification/Comment/Rating`
- `User -> AuditLog` as actor
- `Genre -> Story` through story genre references

Recommended future indexes:

- `User.email` unique
- `OtpToken.userId + purpose + usedAt`
- `Story.slug` unique
- `(Story.creatorId, Story.slug)` query index
- `(Chapter.storyId, Chapter.chapterNumber)` unique
- `(Library.userId, Library.type, Library.storyId)` unique where applicable
- `(Rating.userId, Rating.storyId)` unique
- `Notification.userId` plus read/time index

## Known Contract Gaps

- User suspend/unsuspend admin API is not registered.
- Ranking/cultivation, membership, AudioCoin, payment, creator revenue, and recommendation APIs are not implemented.
- Public story/chapter/audio data exists in-memory only until Phase 3 persistence.
