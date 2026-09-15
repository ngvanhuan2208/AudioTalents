# AudioTalents Database Core V1

**Status:** LOCKED for Phase 3.0  
**Scope:** persistence contract only. This document does not introduce MongoDB, Mongoose, a connection, repository migration, API changes, or frontend changes.

## 1. Architecture and naming

Phase 2 uses `InMemoryRepository` and some polymorphic records. Phase 3 persistence must preserve the existing HTTP contract and service authorization rules. Mongo collection names are lower-case plural equivalents of the model names. IDs below mean `ObjectId` references when MongoDB is introduced; services remain responsible for verifying referenced documents and authorization.

The current runtime names `reviewStatus` for Story moderation and `status` for Chapter/Audio moderation. Those names are **canonical V1 persistence names**. `contentStatus` in planning notes is an alias only and must not be added as a duplicate stored field.

## 2. Core model registry

The Core V1 registry contains exactly these 15 collections:

1. User
2. OtpToken
3. AuthorApplication
4. Genre
5. Story
6. Chapter
7. Audio
8. LibraryItem
9. ListenHistory
10. Playlist
11. Notification
12. Comment
13. Rating
14. Report
15. AuditLog

`models/index.js`, when introduced with Mongoose in Phase 3.2, is a registry only. It must not connect to MongoDB or cause seed/write side effects.

## 3. Shared conventions

Mutable models `User`, `OtpToken`, `AuthorApplication`, `Genre`, `Story`, `Chapter`, `Audio`, `LibraryItem`, `ListenHistory`, `Playlist`, `Notification`, `Comment`, `Rating`, and `Report` have both `createdAt` and `updatedAt`. `AuditLog` is the sole exception: append-only with `createdAt` only. References are nullable only where explicitly marked. Client input can never set protected ownership, moderation, counter, role, verification, status, or audit fields.

### Locked enums

| Name | Values |
| --- | --- |
| Role | `USER`, `ADMIN` |
| Author status | `NONE`, `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED` |
| Account status | `ACTIVE`, `SUSPENDED`, `DEACTIVATED` |
| Moderation status | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED` |
| Story progress (`Story.status`) | `ONGOING`, `COMPLETED`, `PAUSED` |
| Chapter moderation (`Chapter.status`) | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED` |
| Visibility | `PRIVATE`, `PUBLIC`, `UNLISTED` |

## 3.1 Runtime/API → Persistence Compatibility Mapping

| Domain | Runtime field | Runtime value/meaning | Persistence field | Persistence value/meaning |
| --- | --- | --- | --- | --- |
| Story | `status` | `DRAFT`; legacy initial/unsubmitted state, duplicated by runtime `reviewStatus=DRAFT` | `reviewStatus` | `DRAFT`; canonical moderation state. Persisted `Story.status` receives default `ONGOING`. |
| Story | `status` | `ONGOING`, `COMPLETED`, `PAUSED`; story progress | `status` | Same value; canonical story progress. |
| Story | `reviewStatus` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED`; moderation | `reviewStatus` | Same value; canonical moderation. |
| Chapter | `status` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED`; moderation | `status` | Same value; canonical moderation. |
| Chapter | `status` | `PUBLISHED`; legacy read/presentation value accepted as public alongside `APPROVED`, never emitted by current moderation service | `status` | `APPROVED`; repository adapter normalizes on persistence. |
| Chapter | `status` | `HIDDEN`; constant only, with no route/service read or write semantic | — | No persistence mapping. Migration rejects/flags it for manual disposition; it is not a Core V1 stored value. |
| Audio | `status` | moderation state | `status` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED`; never processing. |
| Audio | `processingStatus` | runtime `UPLOADING` compatibility value | `processingStatus` | `PENDING`; canonical processing values are `PENDING`, `PROCESSING`, `READY`, `FAILED`. |

Repository adapters in Phase 3.3 own these transformations and response projection. No duplicate database field exists solely for runtime compatibility.

## 4. Identity and authentication

### User

| Field | Contract |
| --- | --- |
| `username`, `email`, `passwordHash` | required; normalized email is unique; `passwordHash` is private |
| `role` | default `USER`; only `USER` or `ADMIN` |
| `authorStatus` | default `NONE` |
| `emailVerified` | default `false` |
| `accountStatus` | default `ACTIVE` |
| `tokenVersion` | default `0`; invalidates previously issued JWTs when incremented |
| `profile` | `{ bio, avatar }`; both are nullable/empty until supplied |
| `lastLoginAt` | nullable; default `null`; service-managed login audit timestamp |

Indexes: unique `email`. `username` and nested `profile.avatar`/`profile.bio` are the only persistence representation. The runtime/API field `username` is the display name; `displayName`, `avatarUrl`, and root-level `bio` are forbidden duplicate persistence fields. If a future API needs those aliases, its adapter maps them to `username`, `profile.avatar`, and `profile.bio` respectively. Runtime `status` is a backward-compatible response mirror of `accountStatus`; V1 persistence stores only `accountStatus` and a repository adapter may project `status` until the API no longer returns it.

### OtpToken

| Field | Contract |
| --- | --- |
| `userId`, `email`, `purpose` | required; purpose is `EMAIL_VERIFICATION` or `PASSWORD_RESET` |
| `codeHash` | required private SHA-256 hash; plaintext code is never persisted |
| `expiresAt`, `attempts`, `maxAttempts` | required; `maxAttempts` default `5` |
| `usedAt`, `invalidatedAt` | nullable; both prevent reuse |

Indexes: `{ expiresAt: 1 }` TTL with `expireAfterSeconds: 0`; `{ userId: 1, purpose: 1 }`; `{ email: 1, purpose: 1 }`.

TTL is cleanup only. OTP service must still reject `expiresAt <= now`, replay, invalidated tokens, and attempts above the limit. Resend invalidates the prior active token. There is no RefreshToken collection; `User.tokenVersion` remains the JWT revocation mechanism.

### AuthorApplication

Fields: `userId`, `displayName`, `bio`, `contentTypes`, `experience`, `status`, `submittedAt`, `reviewedAt`, `reviewedBy`, `reviewNote`.

`status` is `PENDING`, `APPROVED`, `REJECTED`, or `CANCELLED`. Canonical names are `displayName`, `bio`, `contentTypes`, `experience`, and `reviewNote`; `penName`, `introduction`, and `adminNote` are not stored. `portfolioLinks` is not in the current API/runtime and is out of Core V1 scope. Index `{ userId: 1 }` unique only when `status: 'PENDING'` (partial unique), plus `{ createdAt: -1 }`. A normal unique `{userId,status}` is forbidden because historical rejected/cancelled applications are allowed. Service checks first for a friendly error; the index closes the race condition.

Application/user state is a service invariant: `PENDING → User.authorStatus=PENDING`, `APPROVED → APPROVED`, `REJECTED → REJECTED`, and future `CANCELLED → NONE`. `SUSPENDED` is an administrative author state and is never produced by normal review. Current runtime exposes submit/approve/reject only; cancellation remains reserved without changing that API.

## 5. Content

### Genre

Fields: `name`, `slug`, `description`, `icon`, `isActive` (default `true`), `sortOrder` (default `0`). `slug` is unique. Indexes: unique `{slug:1}`, `{name:1}` for lookup/sorting; `name` is not unique.

### Story

Fields: `creatorId`, `title`, `slug`, `description`, `coverUrl` (runtime `cover` maps here), `genreIds` (runtime `genres` maps here), `tags`, `status` (story progress), `reviewStatus` (moderation), `visibility`, `chapterCount`, `viewCount`, `listenCount`, `favoriteCount`, `ratingAverage`, `ratingCount`, `submittedAt`, `reviewedBy`, `reviewedAt`, `moderationNote`, `publishedAt`, `deletedAt`, `deletedBy`.

Defaults: progress `ONGOING`; moderation `DRAFT`; visibility `PRIVATE`; counters `0`; `tags` is `string[]` default `[]`. The current runtime's `status:DRAFT` at creation maps to `reviewStatus:DRAFT` through the compatibility table, not to persisted Story progress. Tags are an existing runtime create/update field, are not indexed in V1 because no current query pattern requires it, and must not be removed.

Indexes: unique `{slug:1}`, `{creatorId:1}`, `{genreIds:1}`, `{reviewStatus:1,publishedAt:-1}`, `{createdAt:-1}`, and text `{title:'text',description:'text'}`.

Canonical public filter: `{ reviewStatus: 'APPROVED', visibility: 'PUBLIC', deletedAt: null }`.

### Chapter

Fields: `storyId`, `creatorId`, `chapterNumber`, `title`, `slug`, `textContent` (runtime `content` maps here), `status` (moderation), `submittedAt`, `reviewedBy`, `reviewedAt`, `moderationNote`, `publishedAt`, `deletedAt`, `deletedBy`.

Indexes: unique `{storyId:1,chapterNumber:1}`, `{storyId:1,status:1}`. Canonical public local filter is `{ status:'APPROVED', deletedAt:null }`; the repository adapter normalizes legacy runtime `PUBLISHED` to `APPROVED` before persistence. `HIDDEN` has no Core V1 persistence mapping and is never public. Chapter has no separate visibility in V1.

### Audio

Fields: `storyId`, `chapterId`, `creatorId` (runtime `ownerId` is authorization metadata and maps to this ownership chain), `title`, `audioUrl`, `storageKey`, `durationSec`, `fileSize`, `mimeType`, `bitrate`, `voiceType`, `transcript`, `sourceType`, `processingStatus`, `status` (moderation), `isPrimary`, `deletedAt`, `deletedBy`.

`transcript` is a `String` with default `''`; no Transcript collection is created in Core V1. When populated, it is a UTF-8 JSON serialization of the existing timestamped `TranscriptSegment[]` presentation shape. Services/repositories call `JSON.stringify` before persistence when given a structured transcript, and parse safely on reads. Malformed JSON returns an empty transcript presentation with a controlled service error/observability event; it never crashes the API. Clients submit the existing structured transcript shape where the API permits it, never an arbitrary persistence string. The Phase 3 repository/content adapter projects the selected Audio transcript into the existing `Chapter.transcript` response shape. It must not persist a second Chapter transcript field merely to satisfy presentation.

Enums: source `HUMAN|AI|HYBRID`; processing `PENDING|PROCESSING|READY|FAILED`; moderation uses the shared moderation enum. Runtime `UPLOADING` is a legacy compatibility value to be normalized to `PENDING` by the Phase 3 repository adapter, not stored as a second status field.

Indexes: `{chapterId:1}`, `{creatorId:1,status:1}`, `{chapterId:1,status:1,processingStatus:1,isPrimary:1}`, and partial unique `{chapterId:1,isPrimary:1}` where `isPrimary:true` and `deletedAt:null`.

Public filter: `{ status:'APPROVED', processingStatus:'READY', deletedAt:null }`. Default playback query adds `isPrimary:true`; public voice selection must not require primary.

Audio creation derives `chapterId`, `storyId`, and `creatorId` from Chapter then Story; it never trusts body `storyId`/`creatorId`. `setPrimaryAudio(chapterId,audioId,actor)` is a service operation: authorize actor, verify membership/usability, unset prior primary, then set the requested primary. When deleting a primary Audio, service first sets `isPrimary:false`, then sets `deletedAt` and `deletedBy`; restore never automatically reclaims primary. The partial index is the safety net; V1 does not require a Mongo transaction.

## 6. Personalization

### LibraryItem

Fields: `userId`, `storyId`, `isFavorite` (default `false`), `followed` (default `false`), `addedAt`.

Unique index `{userId:1,storyId:1}`; query indexes `{userId:1,isFavorite:1}` and `{userId:1,followed:1}`. Existing in-memory `type: LIBRARY/FAVORITE/...` records require a repository adapter during migration; HTTP `/library` and `/library/favorites` remain unchanged. No separate Favorite collection.

### ListenHistory

Fields: `userId`, `storyId`, `chapterId`, `audioId`, `positionSec`, `durationSec` (nullable), `progressPercent`, `completed`, `lastListenedAt`.

Constraints: `positionSec >= 0`; `durationSec` null or `>= 0`; `progressPercent` is 0–100. Unique `{userId:1,chapterId:1}`; index `{userId:1,storyId:1,lastListenedAt:-1}`. Before writes, service verifies `Chapter.storyId === ListenHistory.storyId`, `Audio.chapterId === ListenHistory.chapterId`, and `Audio.storyId === ListenHistory.storyId`. Changing voices updates the same chapter history; services use progress percentage to map an updated duration. Existing `Library` progress/history records require an adapter in Phase 3.3.

### Playlist

Fields: `userId`, `name`, `description`, `storyIds`, `visibility`, timestamps. Visibility is `PRIVATE|PUBLIC`; `storyIds` is embedded and cannot contain duplicates. Index `{userId:1}`. Service normalization remains primary protection; schema validation is a secondary guard. No PlaylistItem collection in V1.

## 7. Community and system

### Notification

Fields: `userId`, `type`, `title`, `message`, `targetType`, `targetId` (nullable only for `SYSTEM`), `isRead`, `readAt`.

Types remain: `AUTHOR_APPLICATION_APPROVED`, `AUTHOR_APPLICATION_REJECTED`, `STORY_APPROVED`, `STORY_REJECTED`, `STORY_REVISION_REQUIRED`, `CHAPTER_APPROVED`, `CHAPTER_REJECTED`, `AUDIO_APPROVED`, `AUDIO_REJECTED`, `NEW_CHAPTER`, `SYSTEM`.

`targetType` is frozen to `STORY`, `CHAPTER`, `AUDIO`, `AUTHOR_APPLICATION`, `SYSTEM` after migration. The repository adapter maps existing compatible values. Indexes: `{userId:1,createdAt:-1}`, `{userId:1,isRead:1}`.

### Comment

Fields: `userId`, `storyId`, `chapterId` nullable, `parentCommentId` nullable, `content`, `status`, `likeCount` (reserved denormalized field, default `0`). Status: `ACTIVE|HIDDEN|DELETED`. Indexes `{storyId:1,createdAt:-1}`, `{parentCommentId:1}`. There is no CommentLike collection in V1.

### Rating

Fields: `userId`, `storyId`, `stars` integer 1–5, `review` nullable. Unique `{userId:1,storyId:1}`. Story `ratingAverage` and `ratingCount` are maintained by Rating service on create, update, and delete; clients never write the counters.

### Report

Fields: `reporterId`, `targetType`, `targetId`, `reportType`, `description`, `status`, `reviewedBy`, `reviewedAt`, `resolutionNote`.

Target types: `STORY|CHAPTER|AUDIO|COMMENT|USER`; status: `OPEN|REVIEWING|RESOLVED|REJECTED`. Canonical persistence names are `reportType`, `reviewedBy`, and `reviewedAt`; `type` and `handledBy` are forbidden aliases. Current chapter-report runtime returns `reportType` and legacy `resolvedAt`; its Phase 3 repository adapter maps `resolvedAt` to canonical `reviewedAt` without changing the HTTP shape. Indexes `{status:1,createdAt:-1}`, `{targetType:1,targetId:1}`. Mongo cannot enforce polymorphic target existence; Report service must load the target model selected by `targetType` before creating a report.

### AuditLog

Append-only fields: `actorId`, `action`, `targetType`, `targetId`, `metadata`, `ipAddress`, `userAgent`, `createdAt`. Indexes `{actorId:1,createdAt:-1}`, `{targetType:1,targetId:1}`. `targetType` remains flexible. No update or delete route/service, including for admins.

## 8. Moderation, deletion, counters, and responsibility

### Moderation state machine

Story, Chapter, and Audio follow `DRAFT → PENDING_REVIEW → APPROVED|REJECTED|REVISION_REQUIRED`; an edit after approval returns content to `PENDING_REVIEW` under the existing service rules. Authors cannot set approval states from request bodies; admins review through explicit operations.

Story, Chapter, and Audio use soft deletion with `deletedAt` and `deletedBy`. Public and normal creator queries exclude deleted records unless a future restore/trash workflow explicitly requests them. Comment deletion remains `status: DELETED`; user deactivation does not delete owned documents.

Local-document public filters are insufficient by themselves. A public Chapter also requires its parent Story to satisfy Story public filter. A public Audio also requires its parent Chapter public rule and parent Story public rule. Repository/service owns this parent-chain visibility check. Chapter creation loads and authorizes Story, assigns `chapter.storyId=Story._id` and `chapter.creatorId=Story.creatorId`, and never trusts body `creatorId`; therefore `Chapter.creatorId === Story.creatorId` is a locked cross-document invariant.

Counter owners: Chapter service owns `chapterCount`; Library service owns `favoriteCount`; Rating service owns `ratingAverage/ratingCount`; listening operations own `listenCount`; story-view operations own `viewCount`. In Mongo these use targeted atomic updates (`$inc`, `$set`, or an aggregate/update calculation). Clients never write counters.

Database responsibility: type, required, enum, ranges, indexes, uniqueness, TTL, and basic validation. Service responsibility: authorization, ownership, moderation transitions, cross-document integrity, counter updates, primary-audio selection, report target validation, notification generation, OTP state, and deletion operations. No side-effect-heavy Mongoose hooks.

## 9. Deferred models and tradeoffs

Excluded from Core V1: Wallet, CoinTransaction, Payment, Membership, VIP, CreatorEarning, CreatorPayout, Gift, CommentLike, RefreshToken, Recommendation, ranking persistence, and PlaylistItem.

Known tradeoffs: local Mongo can run standalone, so multi-document transactions are not required by this contract. Repository adapters will reconcile current `reviewStatus/status`, `cover/genres/content`, polymorphic Community records, and Library type records without changing HTTP responses. In-memory data is intentionally non-persistent until migration.

## 10. Query patterns protected by indexes

Public story discovery/search; creator-owned content; ordered chapters; public/default audio selection; library/favorites; continue listening; notification inbox/unread state; comment threads; ratings per story; reports by state/target; and audit trails by actor/target are all covered by the indexes specified above.
