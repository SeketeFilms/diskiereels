
# DiskieReels v1.0 — Master Fix Plan

This is a large batch (~15 distinct asks). I'll execute in 5 ordered batches. After each batch lands you can spot-check before I move on. Total ETA: several turns.

---

## Batch 1 — Branding & Native Shell

- Generate new **"D + soccer ball"** icon on red-orange gradient (matches current brand) at premium quality.
- Replace ALL icon sizes: `public/diskiereels-icon.png` (512), 192, 180 (iOS), 32 favicon, splash logo, `src/assets/diskiereels-logo.png`.
- Update PWA manifest (`vite.config.ts`) — full Android icon set (48/72/96/144/192/512 + maskable) and iOS apple-touch-icon link.
- `capacitor.config.ts`: bump versionName `1.0.0`, ensure no dev `server.url` block for release.
- `android/app/build.gradle`: `versionCode 1`, `versionName "1.0.0"`.
- Add Android permissions to `AndroidManifest.xml`: CAMERA, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, WRITE_EXTERNAL_STORAGE (legacy), POST_NOTIFICATIONS, INTERNET.
- Add iOS `Info.plist` usage strings: NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription, NSMicrophoneUsageDescription.
- Add in-app **Permissions** panel in Settings (request + status display).

## Batch 2 — Reel Player Fixes

- **Sticky For You / Following tabs**: move higher, position `fixed top-2` with safe-area padding, z-index above video, persists across reel changes (currently re-renders per reel).
- **Remove "DiskieReels" wordmark** next to the tabs; keep only the watermark on the video itself.
- **Volume ON by default** on every reel start (override mute state); requires user-gesture unlock fallback for browsers that block.
- **Mutual followers chip** Insta/FB-style: small floating clickable bubble showing 1–2 mutual avatars + "Followed by X & Y". Settings toggle to hide. Draggable to dismiss.

## Batch 3 — Downloads, AI, Profile Fixes

- **Download fix**: current Canvas-watermark + blob save fails on Android WebView ("Failed to Download Video"). Switch to Capacitor `Filesystem` + `Media` plugins; save to device gallery at original 1080p. Show in-app progress, no app-exit.
- **DiskieAI fix**: Console shows `TypeError: Failed to fetch` from `DiskieAI.tsx:63`. Fix the edge function URL/auth and add proper error surfacing so users actually get answers.
- **Followers/Following list**: render clickable avatar+username rows linking to `/profile/:userId` (currently empty/non-clickable).
- **Settings open speed**: lazy-load heavy children, render shell synchronously.
- **Username change** working with optimistic UI + DB write + re-fetch.
- **Avatar square-crop**: replace stretch with `react-easy-crop` square modal before upload; store cropped result.

## Batch 4 — Inbox (Adults-Only, Text-Only)

Per your choice — text-only DMs gated to 18+ verified accounts:

- DB migration: `conversations` & `messages` tables already exist — add `text_only` constraint (no media columns), add `inbox_privacy` enum on profiles (`everyone` | `followers` | `nobody`), default `nobody`.
- RLS: only `authenticated` users with `dob` ≥18 + privacy allows can insert.
- `/inbox` route with thread list + chat view.
- Settings → Privacy → "Who can message me" dropdown.
- **Update safety memory** to reflect the new policy carve-out (adults-only, text-only).

## Batch 5 — Monetization, Upload UX, View Count

- **View count 24h dedup**: already implemented in `increment_video_views` (verified ✅). Add unit assert in code that calls it once per session.
- **Engagement-based earnings**: rework `creator_monetization` to FB-style — pay per engagement (views + likes + comments + saves + watch-time), gated to creatives meeting thresholds, with active-uploader requirement (≥1 reel/14 days).
- **Upload form**: rename field label "Title" → "Description", remove the separate description box, single field used.
- **Thumbnail picker**: on upload, auto-extract 3 frames (at 25%/50%/75% of duration) using `<video>` + canvas, show 3 thumbnails, user picks one. Store selected URL on `videos.thumbnail_url`.

---

## Technical Notes

- Capacitor APK/AAB compilation can't run in this sandbox. After Batch 1 lands I'll give you exact local commands: `npm i && npm run build && npx cap sync android && cd android && ./gradlew assembleRelease bundleRelease`.
- All Supabase changes go through migrations; expect ~2 migrations (inbox + monetization).
- I'll re-verify with build output + console after each batch.

---

**Approve to start Batch 1, or tell me to re-order / drop items.**
