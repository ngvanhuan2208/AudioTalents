# AudioTalents Creator Content V2.1 — Audio Part Ordering

## Contract extension

`Audio.partNumber` is a positive integer scoped to `chapterId`. New Audio
records receive `max(historical partNumber) + 1`; the value is immutable during
metadata edits, media replacement, soft-delete, and restore. `isPrimary` keeps
its separate default-playback meaning and is not derived from `partNumber`.

The Mongo schema adds a partial unique index on
`{ chapterId: 1, partNumber: 1 }` for numeric `partNumber` values. The partial
predicate allows legacy documents to be inspected before the explicit
backfill, while preventing duplicates for all migrated/new records.

Creator, public, and admin Audio DTOs expose `partNumber`; storage credentials,
storage keys, signed URLs, and upload/playback capabilities remain private.
All Audio list queries sort by `partNumber: 1` after migration.

## Legacy backfill (not run)

Run once as an explicit migration after a snapshot and a dry-run report. Select
Audio documents whose `partNumber` is absent, group by `chapterId`, order by a
stable immutable identifier (`_id` ascending), and assign the next unused
positive number after the chapter's current maximum (including soft-deleted
rows). Abort on any duplicate/conflicting value; do not seed, fabricate
content, or renumber existing values. Create/validate the unique index only
after the backfill succeeds. No production-like data was changed by V2.1.
