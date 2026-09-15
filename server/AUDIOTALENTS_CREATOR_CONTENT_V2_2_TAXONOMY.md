# AudioTalents Creator Content V2.2 — Taxonomy Contract

**Status:** implemented extension to Core V1. This document does not change authentication, moderation, media delivery, or the HTTP contract of existing story endpoints.

## Canonical ownership

`Genre` and `Tag` are Admin-owned catalogs. Creator accounts remain `USER` with `authorStatus: APPROVED`; no `AUTHOR` role is introduced. Active catalog records are selectable. Inactive records remain readable for historical stories and are not selectable for new or edited content. No hard-delete or seed data is introduced.

## Genre compatibility

Before V2.2, `Genre` already supported public `GET /genres` and Admin create; full Admin list/update/active-state operations were missing. V2.2 adds `GET /genres/admin/all`, `PATCH /genres/:id`, and `PATCH /genres/:id/active`. Existing Story references are retained when a Genre is deactivated. Duplicate checks normalize trim, repeated whitespace, case, and slug equivalence; conflicts return a controlled error rather than merging records.

## Tag catalog

`Tag` is a new canonical collection with `name`, `normalizedName`, `slug`, `isActive`, and timestamps. Unique indexes protect normalized name and slug; an active/name lookup index supports bounded catalog reads. Public `GET /tags` returns active records only. Admin `/admin/tags` lists all records and supports create, update, deactivate, and reactivate. `Story.tags` remains the compatible `string[]`; selected canonical Tag names, not ObjectIds or client labels, are persisted.

## TaxonomyProposal

The separate `TaxonomyProposal` collection stores only `GENRE` or `TAG` proposals with `proposedName`, `normalizedName`, `reason`, `proposerId`, `storyId`, `status` (`PENDING|APPROVED|REJECTED`), reviewer metadata, optional `resolvedTaxonomyId`, and timestamps. A Creator may propose only against an owned Story and only with approved author status. Admins list/view/approve/reject. Rejection requires a review note. A proposal is not copied into `Story.tags` or fabricated into `Story.genreIds` while pending.

Creator proposal endpoints are `POST/GET /taxonomy-proposals` and `GET /taxonomy-proposals/:id`. The old `/tags/proposals` path is not a canonical namespace. Admin endpoints are `GET /admin/taxonomy-proposals`, `GET /admin/taxonomy-proposals/:id`, and `PATCH /admin/taxonomy-proposals/:id/approve|reject`.

Approval validates the pending snapshot, checks normalized duplicates, creates or resolves one canonical record, attaches its Genre id or Tag name to the related Story, and records reviewer metadata. The repository adapter performs the conditional review as the final compare-and-set step; a second review receives a controlled conflict. No Mongo transaction is assumed in this phase.

## Story workflow

Drafts may be saved without classification. Submission requires at least one canonical Genre or a pending Genre proposal. Admin Story approval refuses a Story with neither a canonical Genre nor a pending proposal, using a taxonomy validation error; taxonomy proposal status is never reused as Story moderation status. Rejected optional Tag proposals do not reject a Story automatically. Creator workspace exposes active searchable Genre/Tag selectors and a labelled proposal form with safe status/feedback from the proposal API.

## Admin UI and audit policy

The existing Admin Control Center now contains a responsive Genre/Tag catalog area and a pending proposal review area. It uses the canonical Admin APIs, supports active/inactive toggles, inline search/filtering, modal edit/reject forms, and does not display secrets or use browser prompts. Existing AuditLog producer policy is unchanged: no new producer strings were added in V2.2, avoiding duplicate logging; meaningful Admin mutations remain governed by the existing service policy.

## Core V1 impact

Core V1 fields keep their semantics: `Story.status` is progress, `Story.reviewStatus` is moderation, and `Story.tags` remains a string array. V2.2 adds two explicit extension models (`Tag`, `TaxonomyProposal`) and their indexes; it does not add duplicate Story fields, migrate existing records, connect MongoDB, or seed catalogs.
