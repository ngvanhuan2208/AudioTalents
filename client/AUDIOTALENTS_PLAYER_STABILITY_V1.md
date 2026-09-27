# AudioTalents — Player Stability & Playback Wiring V1

## Problem and root cause

The Home and Rankings list Story DTOs do not include a playable Chapter/Audio graph, yet quick-play passed them directly to `AudioContext.playStory`. The backend returns root-relative `/api/audio/:id/playback` paths, which the HTML audio element previously resolved against the client origin. ExpandedPlayerModal and Reader also returned before declaring all Hooks. The Home hero used chapter number 128 without an API-backed chapter lookup.

## Playback entry contract

Every `playStory(story, chapterIndex?, startSec?)` call resolves the public Story detail and its public Chapters/Audio through existing APIs. The public Audio endpoint is the authority for approved/READY sources and parent visibility. The client never fabricates Chapters or uses the list Story's `chapters` as playback authority. Quick-play selects the first playable Chapter in chapter-number order. A requested Chapter must itself be playable; it does not silently switch to another Chapter. Within a Chapter, valid numbered Audio parts play by `partNumber` ascending. `isPrimary` is not an ordering key. Unnumbered legacy parts retain server order after numbered parts.

An empty result displays “Chưa có tập Audio khả dụng.” and leaves no selected/playing Story. A failed API request displays a safe generic error. HTML audio errors stop playback without displaying URLs, tokens or storage details. A monotonically increasing request version prevents an older quick-play resolution from replacing a later selection. `isPlaying` reflects the audio element's `playing` event, not merely a pending request. Playback controls seek the actual audio element.

## Playback URL

The central API helper resolves root-relative playback paths against the API host configured by `VITE_API_URL`, without doubling `/api`. Absolute HTTP(S) URLs remain unchanged, including signed external URLs; unsafe schemes and protocol-relative URLs are rejected. Public playback remains anonymous where the backend permits it. Creator/Admin private preview continues using its separate playback-capability flow; this phase does not change backend authorization.

## Verification and remaining blocker

Run `npm run test:player`, `npm run lint`, and `npm run build` in `client`, plus `npm test` in `server`. The player tests cover URL handling, part ordering, list Story resolution, no playable Audio, requested-Chapter behavior, and request precedence. There is no browser component-test harness in this repository, so a no-selection → selection Hook transition still requires browser acceptance. No backend or database change was made. Real media E2E remains blocked until the existing isolated MinIO/storage environment is configured; do not substitute fake canonical data or bypass signing. ListenHistory persistence is outside this phase.

## Human browser acceptance (not yet run)

Use an approved/public Story with an approved Chapter and one or more approved, READY Audio objects stored in the configured media service. Also use a public Story without playable Audio and two playable Stories A/B. Do not seed the canonical development DB solely for this checklist.

1. Home → “Nghe ngay”: expect the first playable Chapter and `partNumber=1` to start; no hardcoded chapter 128.
2. Rankings → play: expect the same resolution and Audio URL behavior as Home.
3. Story Detail → “Nghe từ đầu”, then a specific Chapter: expect first playable part of the chosen Chapter. With parts 1/2/3, allow each to end and verify playback order 1 → 2 → 3.
4. Story without playable Audio → play: expect “Chưa có tập Audio khả dụng.”, no playing state and no stale Story in the dock.
5. Open/close Expanded Player before and after selecting Audio: expect no Hook-order warning and preserved playback controls.
6. Enter Reader before and after selecting Audio: expect no Hook-order warning; without selection, show the existing empty state.
7. Click A then B quickly while A's API response is delayed: B must remain selected.
8. Inspect browser console: no Hook-order, unhandled promise, token or storage-key output.
9. Inspect Network: Story/Chapter/public Audio requests use the configured API; `/api/audio/:id/playback` goes to API origin, returns the backend redirect, and does not become `/api/api/...`. Real signed playback still depends on MinIO/storage availability.
