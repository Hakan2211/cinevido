# Cinevido Relaunch — Roadmap

The working plan for turning Cinevido from a starter template into an AI film
studio: a curated model catalog with real prices, a new UI, and an agentic
Director that plans, budgets and renders a whole production.

**How to use this file:** point an agent at one phase ("Do Phase 3 of
docs/ROADMAP.md"). Each phase lists scope, the files involved and how to know
it's done. Tick the boxes as work lands, and add anything you decide along the
way to *Decisions*. Read *Rules for every change* first.

Mockups (generated with GPT Image 2.5) live in [`docs/design/mockups/`](design/mockups/):

| # | Screen | File |
|---|---|---|
| 1 | Design system sheet | `01-design-system.jpg` |
| 2 | Home | `02-home.jpg` |
| 3 | Generate lab (video) | `03-generate-lab.jpg` |
| 4 | Studio (Director main screen) | `04-studio.jpg` |
| 5 | Storyboard review (draft → final) | `05-storyboard-review.jpg` |
| 6 | Settings → Providers & usage | `06-settings.jpg` |

The mockups are direction, not spec: fake data in them (Kling 1.6, Runway, $24.50)
is decoration. Where a mockup shows something the backend can't do yet, build
the real thing or leave it out — never ship a control that does nothing.

---

## Rules for every change

1. **Models live in one place.** The catalog is `src/server/services/types.ts`
   (`IMAGE_MODELS`, `EDIT_MODELS`, `VIDEO_MODELS`, `AUDIO_MODELS`,
   `MUSIC_MODELS`, 3D, upscale, motion). Defaults come from `DEFAULT_MODELS`;
   never hard-code a model id elsewhere. Use `resolveModelId()` for anything
   read from the database (user preferences, old jobs).
2. **Every model has a tier and a price.** `tier: 'draft' | 'standard' | 'hero'`
   (no tier = specialist) and `pricing` (a `PriceRule` from `src/lib/pricing.ts`).
   Price at the endpoint's **default** resolution, audio on — that's what
   Generate charges unless the user changes it. Sources: fal's pricing API
   (`GET https://api.fal.ai/v1/models/pricing?endpoint_id=…`) plus the pricing
   note on `fal.ai/models/<id>` for resolution/audio multipliers. Token-billed
   models get a `range` or no price — never invent a number.
3. **Only send fields a model's schema declares.** Payload builders
   (`buildImagePayload`, `buildVideoPayload`, `buildEditPayload`,
   `buildMusicPayload`, `build3DModelPayload`) read capability flags from the
   config (`supportsSeed`, `supportsNegativePrompt`, `aspectRatios`,
   `resolutions`, `supportsAudio`, `durations`). After adding or changing a
   model, run the free live schema check:
   ```bash
   LIVE_FAL_SCHEMA=1 npx vitest run src/server/services/payloads.live.test.ts
   ```
   It builds every payload for every mode/duration/aspect/resolution and
   validates it against fal's OpenAPI schema. It must be green.
4. **Design tokens, not colours.** Use the Tailwind tokens from `src/styles.css`
   (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`…). No raw
   hex, no blue, no glow/gradient effects. One amber accent, used for primary
   actions, selection and progress only.
5. **Show the cost before the click.** Any button that spends fal credits shows
   `formatEstimate(estimateCost(model.pricing, params))` — "Generate · ≈ $0.47".
6. **The user's own key.** Server code that calls fal on a user's behalf uses
   `getUserFalApiKey(userId)`; store fal's `status_url`/`response_url` on the
   job and poll those (never rebuild queue URLs from a model id).
7. **Done means:** `npx tsc --noEmit -p .` adds no errors (1 known pre-existing:
   `vite-plugin-server-only.ts`),
   `npm run test` is green, and the screen was looked at in the running app.
   Don't press Generate in tests — generation is live and costs money.

---

## Status

### Phase 1 — Curated models, prices, credit balance ✅ (2026-11-11)
- [x] Catalog cut from ~75 endpoints to a tiered lineup; 9 dead endpoints removed (Sora 2, ImagineArt, Bria, Aging)
- [x] New models: Kling 4.0 (+Flash), Seedance 2.5, MiniMax H3 Max/Turbo + H3 Image, Gemini Omni Flash, Seedream 5 Pro/Flash, Krea 3, FLUX 3 (+Klein), GPT Image 2.6, Nano Banana 2.1, Ideogram 4.5, Recraft 4.1, Eleven v4, ElevenLabs Music v2.5, Lyria 3.5, Meshy 7.1
- [x] `src/lib/pricing.ts` — price rules, estimates, formatting; prices in pickers and on Generate/Edit buttons
- [x] fal credit balance via a separate read-only billing key (`FAL_BILLING_KEY` for admins, per-user key in Settings)
- [x] Aging feature removed; 3D kept
- [x] Director fixes: image/video tools defaulted to retired models, ran on the server key instead of BYOK, and polled with wrong arguments
- [x] Tests: `catalog.test.ts` (offline), `payloads.live.test.ts` (live schema check)

### Phase 2 — Design system + app shell + Home ✅ (2026-11-11)
- [x] Tokens from mockup 1 in `src/styles.css`; Inter + Playfair Display (wordmark only), self-hosted via Fontsource
- [x] Buttons restyled; legacy glow utilities neutralised
- [x] `AppTopbar` replaces the sidebar: wordmark · Home / Projects / Create · lab switcher on Create pages · credit pill · account menu; mobile sheet
- [x] Home (`/dashboard`, mockup 2): prompt → creates a project, hands the brief to the Director (via `sessionStorage`), opens Studio; recipe chips; recent projects + creations

### Phase 3 — Generate labs (mockup 3) ✅ (2026-11-11)
- [x] **Video lab** (`src/routes/_app/videos/index.tsx`): left settings panel, mode inferred from frames (none → T2V, start → I2V, start+end → keyframes), tiered model radio list with rates, duration slider, aspect cards, audio switch, Generate · ≈ $X; results grid with model + cost per clip; Upscale as a tab
- [x] **Image lab** (`src/routes/_app/images/index.tsx`): same layout; panel tabs **Create / Edit / Upscale** (`?mode=`); Create shows batch only if `supportsNumImages`, GPT quality + format only for GPT models, negative prompt only if `supportsNegativePrompt`; Edit takes up to the model's `maxImages` numbered references; Upscale prices output megapixels; results grid with model + cost, hover Animate / Edit / Upscale / Download / Delete; edit/upscale results open a before/after from the "Compare" toast
- [x] Shared pieces extracted to `src/components/generate/` (`Field`, `Segmented`, `ModelRadioList`, `FrameSlot`, `AspectCards`, `PromptBox`, `LabShell`/`LabPanel`/`LabResults`, `GenerateButton`, `ResultCard`/`PendingCard`, `ImagePickerDialog`); video lab moved onto them
- [x] **Audio lab** (`/music`, top-bar "Audio"): tabs **Music / Voice / SFX** (`?tab=`) on the lab layout, one transport across the bottom, inspector on the right, cost per row. Voice = Eleven v4 / v4 Turbo, 22 premade voices (`TTS_VOICES`), stability, cost per 1k chars. SFX = `elevenlabs/sound-effects/v3` ($0.002/s, `SFX_MODELS`), auto or 0.5–30s length, loop, prompt influence; assets of type `sfx` land on the SFX lane. TTS + SFX payloads are in the live schema test
- [x] **3D** (`?mode=` Text / Image / World) and **Motion** labs on the same layout and cards; old `Model3DModeToggle`, `Model3DModelSelect`, `MotionControlPanel` deleted
  - 3D prices: Hunyuan3D V3 by generate type + $0.15 add-ons (PBR, custom face count, multi-view); Meshy $1.20 textured (the default) / $0.80 untextured — was $0.80; SAM 3D $0.02; Seed3D removed (deprecated on fal)
  - Motion: the endpoint has no `duration` (output follows the reference clip, ≤30s match-video / ≤10s match-image) and no audio fields — those were sent before; now `buildMotionControlPayload` (live-schema-checked), real `keep_original_sound` switch, priced at the measured clip length
  - Video lab Upscale tab rebuilt too, with a cost (`src/lib/video-upscale-cost.ts`: SeedVR per output MP×frames, Topaz/Bytedance per second by output size, 60fps ×2)
- [x] Deleted `VideoModeToggle.tsx` / `ModeToggle.tsx` (plus the old bottom-bar `EditPanel` / `UpscalePanel`); 1 known TS error left (`vite-plugin-server-only.ts`)
- [x] Resolution picker in the video lab: `defaultResolution` on every `VideoModelConfig` with resolutions (from fal schemas; a test pins that `pricing.usd` is quoted at it), segmented control when there are >1, priced via `estimateCost`; result cards price clips at the resolution/audio they were rendered with

**Done when:** all five labs share one layout and component set, every Generate button shows a cost, and nothing references the old bottom-bar layout.

### Phase 4 — Settings (mockup 6) ✅ (2026-11-11)
- [x] Profile → **Settings** (`/settings/general|providers|billing`, `/profile` and `/settings` redirect) with a left sub-nav: General · Providers · Plans & Billing. No Team / Notifications / Appearance — nothing behind them (dark-only app, no email)
- [x] **Providers** (`src/components/settings/ProviderCards.tsx`): fal key card (connected / test / replace / remove), read-only Billing key card (old `FalCreditSection`, deleted), Bunny storage card
- [x] **Usage** (`UsageSection.tsx`, `src/server/usage.server.ts`): balance, spend this month, daily spend chart, last 10 jobs (kind, prompt, model, length, cost, created, status; generations + 3D)
  - `estimatedCostUsd` on `GenerationJob` and `Model3DAsset`, written at submit time by every create site (labs, `generation.server`, Director executor) from `src/lib/job-cost.ts` — the same math as the Generate buttons. SFX is re-priced at the real length when it returns; upscales send the measured source size (`sourceWidth/Height[/DurationSec]`) so output size can be priced
  - Month spend and the chart use fal's usage API (`/v1/models/usage?expand=time_series&timeframe=day`) via the billing key — real, whole fal account; without a billing key they fall back to the sum of our estimates. Removed `getFalUsageFn` (it called that API with the generation key, which fal answers 403)
- [x] Low-balance threshold (`User.lowBalanceUsd`, default $2) set under Usage; the credit pill turns amber below it and red below a quarter of it
- [x] Tests: `src/lib/job-cost.test.ts`

### Phase 5 — Director v2: the agentic production loop (mockups 4 + 5)
The core of the product. Today the Director is a chat with 7 tools that fires
generations one at a time. v2 turns a brief into an approved, budgeted plan and
runs it.

1. **Plan** — new tool `proposePlan` returns a structured storyboard:
   `{ title, format, shots: [{ id, title, description, durationSec, model, prompt, estimateUsd }], totals: { draftUsd, finalUsd } }`.
   Stored on the project (`Project.plan` JSON). Rendered in chat as shot cards
   (mockup 4) with **Edit plan** / **Render drafts**.
2. **Budget** — composer has a budget pill ("Budget $10") and Draft | Final
   toggle. The agent picks models by tier within budget: drafts on Draft tier
   (Gemini Omni Flash / H3 Turbo), finals on Hero (Kling 4 / Veo 3.1 / Seedance 2.5).
   A run stops before exceeding the budget.
3. **Render drafts** — all shots in parallel; a **Jobs** panel (right column,
   mockup 4) shows per-shot progress; a **Spend** card shows session spend +
   fal balance.
4. **Self-check** — when a draft finishes, a vision model compares a frame to
   the shot description and returns `{ ok, note }` ("Hand looks distorted —
   retry suggested").
5. **Storyboard review** (mockup 5) — per shot: draft, AI note, **Keep / Retry /
   Promote to final**; header shows approved count and final render cost;
   **Render finals** re-renders kept shots on the Hero model (image-to-video
   from the draft's first frame keeps composition).
6. **Assemble** — finals land on the timeline in order; voiceover / music
   tools fill their lanes.
7. Later: **Project Bible** (characters, style, voices with reference images,
   used via Kling 4 Reference / Nano Banana edit for consistency) and
   **Recipes** (the Home chips become real multi-step workflows).

Files: `src/server/agent/*` (tools, executor, system prompt),
`src/components/studio/*` (Workspace, ChatPanel, new StoryboardBoard, JobsPanel),
`src/routes/api/chat.ts`. Studio is open to all users since 2026-11-11.

**Done when:** "30-second coffee ad" on Home produces a priced 6-shot plan,
drafts render within budget, review lets you keep/retry, finals render and
assemble on the timeline — without typing a second message.

**Status (2026-11-11) — built; verified in mock mode (no paid end-to-end run, by decision)**
- [x] `Project.plan` (JSON) + `Project.budgetUsd` (default $10), migration `20261111200000_project_plan_budget`
- [x] `src/lib/production.ts` — plan types, pricing (job-cost math), duration snapping, budget-aware final model ladder, edit semantics, the runner's state machine (`shotNeed`, `needsAssembly`, `planActive`); tests in `production.test.ts`
- [x] Models in `DIRECTOR_MODELS` (types.ts): still = Seedream 5 Flash, draft = MiniMax H3 Turbo I2V, finals ladder Kling 4 1080p → Kling 4 720p → Kling 4 Flash, music ACE-Step, voice Eleven v4, frame extract `fal-ai/ffmpeg-api/extract-frame`, self-check Gemini 2.5 Flash
- [x] Runner `src/server/agent/production.server.ts`: poll → submit within budget → self-check → assemble; server fns in `src/server/production.server.ts`; the Studio ticks every 4s while active
- [x] Tools `proposePlan`, `updateShot`, `renderPlan`; system prompt rewritten; budget/mode/plan in context; the loop no longer re-requests every final reply just to stream it (it paid twice)
- [x] Studio tabs **Director** (assets · chat with PlanCard + budget pill + Draft|Final · Jobs + Spend) / **Storyboard** (mockup 5) / **Edit** (old layout); Edit plan dialog; mobile gets a Board tab
- [x] Verified: full loop in `MOCK_GENERATION` mode (6 drafts → refuse over budget → 4 keep + 1 promote → finals + voice + music → assembled in order, idempotent; spend = Σ job estimates); self-check live on fal's sample clip (match → ok, wrong brief → "retry suggested", $0.0002 each)
- [x] ~~One real end-to-end run from Home (≈$8.50)~~ — dropped: too expensive for a test; the mock-mode loop plus the live self-check stand in
- [x] Studio, Projects and Home's Create flow open to every user (2026-11-11). Before opening: `/api/chat` GET/DELETE and `runAgent` now check the project is the caller's, and every generation endpoint that files an asset under a client-sent `projectId` goes through `ownedProjectId()` (`src/server/project-access.server.ts`)
- [x] **Project Bible** (item 7, 2026-11-11): `Project.bible` JSON (migration `20261111220000_project_bible`), `src/lib/bible.ts` (+ tests). Style (appended to every still), narrator voice (used by the voiceover), cast of characters / products / places with reference images (max 8). Shots carry `cast` (entry ids); a still whose cast has images is made by `DIRECTOR_MODELS.referenceStill` (Nano Banana 2.1 Edit, `aspect_ratio` = plan aspect, live-schema-checked) from those images, otherwise text-to-image as before. A new cast drops the still like a new prompt
  - Studio **Bible** tab (desktop and mobile, `BibleBoard.tsx`, `useBible.ts`): edit style / voice / cast, pick or upload a reference, or **Generate · ≈ $0.027** a reference portrait (Seedream 5 Flash, polled by `pollBibleFn`); Storyboard shots get a "use this still as the reference for…" menu; Edit plan has per-shot cast chips (priced live)
  - Director: new `updateBible` tool; `proposePlan` / `updateShot` take `cast` by name (unknown names are dropped with a warning); Bible summary in the context; system prompt section
  - Verified in `MOCK_GENERATION` mode on the demo project: Bible tab loads/saves, Generate → reference lands on the entry, still → reference from Storyboard, cast chip re-prices the draft ($1.36 → $1.38)
- [x] **Recipes** (item 7, 2026-11-11): `src/lib/recipes.ts` (+ tests) — Product ad, Explainer, Music video, Social short, Trailer. A Home chip opens a short form (required subject, optional photo); Create makes the project at the recipe's format and budget with a seeded Bible (photo → reference image, look → description, recipe style) and hands the Director a structured brief (shot pattern, voiceover/music, "put X in the cast"). Nothing renders until the user presses Render. Not pressed end-to-end (the brief starts a paid Director chat)

### Phase 6 — Polish ✅ (2026-11-11)
- [x] **Projects** (`/projects`): same cards as Home (16:9 thumb, name, "Edited … ago", design-sheet status chip, duration), delete in a "…" menu, folders as a plain left column, empty state points to Home. Cards without `thumbnailUrl` show the project's first image (`FIRST_IMAGE` in `project.server.ts`, Home too). Dropped the "All Projects" count (it summed only foldered projects)
- [x] **Library** (`/library`, top-bar "Library"; Home's "Recent creations → View all"): every image / video / audio (voice, music, SFX) / 3D model, tabs with counts (`?kind=`), infinite scroll (`listLibraryFn`, `getLibraryCountsFn` in `src/server/library.server.ts`), hover-play videos, inline audio play, preview dialog with Animate / Download / Open in lab / Open project. No delete — that stays in the labs
- [x] **Provider marks** (`src/lib/model-icons.tsx`): monochrome per the design sheet; Google / OpenAI / BFL logos, lettermarks for the rest (Krea "Kr", Ideogram "Id", Meshy "Me", ElevenLabs "11", …) instead of guessed logos; now shown in every lab's `ModelRadioList` and the landing catalog. Deleted the unused `model-select.tsx`
- [x] **Landing**: hero "Ideas become films." without orbs or gradient text; Models section read from the catalog (names, tiers, fal rates — no more retired models); new Director section; wordmark in header/footer; leftover blue/violet/green swapped for tokens; 5 unused legacy sections deleted
- [x] **Login / signup**: wordmark above the form, new card style
- [x] **Price drift** (Admin → Price drift): `src/lib/price-drift.ts` (+ tests) compares each catalog rule to fal's pricing API (`src/server/price-drift.server.ts`, batches of 40, admin's key). First run, 62 endpoints: 44 match, 3 unpriced (MiniMax H3 Image — fal bills "units"), 11 in units we can't compare (GPT Image, Nano Banana 2.1, Seedance tokens, Hunyuan3D, Ideogram), **4 drift: MiniMax H3 Max / Turbo** (fal base $0.035/s and $0.0175/s vs our 480P rates $0.05/s / $0.025/s) — check the model pages before changing them

---

## Decisions

- **2026-11-11** — Cut Aging (endpoints dead on fal). Keep 3D.
- **2026-11-11** — Seedream: no 5.5 exists on fal; use Seedream 5 Pro + Flash.
- **2026-11-11** — Credit balance uses a *separate read-only* fal key; a normal
  generation key gets 403 on `/v1/account/billing`.
- **2026-11-11** — Visual direction: dark graphite + one amber accent, close to
  Aurea; top bar instead of sidebar; dark-only.
- **2026-11-11** — Video lab infers mode from frames instead of mode tabs.
- **2026-11-11** — List rates show the default-resolution, audio-on price
  (what Generate charges), not the cheapest setting.
- **2026-11-11** — Image lab: results are a square-cropped grid (newest first),
  not CSS-column masonry, which would read top-to-bottom per column. Edit on a
  card *adds* a reference while you're on the Edit tab, otherwise starts a new edit.
- **2026-11-11** — Home hands the brief to Studio through `sessionStorage`, not
  the URL, so prompts stay out of browser history.
- **2026-11-11** — Audio lab: voice and SFX generate synchronously (seconds), so
  they show a local pending row instead of a polled job. Music stays queued.
- **2026-11-11** — Price rules: `flat` gained `byQuality` (modes) and `addOns`
  (surcharges) for 3D. Unit rates under a cent show two significant digits
  ("$0.0002/s") instead of "<$0.01".
- **2026-11-11** — When a cost depends on something unknown until run time (SFX
  auto length, Motion before the clip loads) Generate shows the ceiling: "≤ $0.06".
- **2026-11-11** — Motion: no image-URL paste any more (character comes from the
  library picker, which uploads); the motion clip can still be a pasted URL.
- **2026-11-11** — Settings → Usage: month spend and the daily chart are fal's
  real numbers (billing key, whole account, UTC days); the jobs table is our
  per-job estimate (fal's per-request billing is enterprise-only). A cost range
  is stored as its midpoint; failed jobs don't count toward spend.
- **2026-11-11** — Director v2: each shot is still → draft → final, and draft and
  final both animate the *same still* (image-to-video). That keeps composition
  without extracting a first frame. The self-check does extract one (middle
  frame, fal ffmpeg util) to judge the draft.
- **2026-11-11** — Review semantics: **Keep** = re-render on the final model;
  **Promote to final** = use the draft as it is (no cost); **Retry** = new still
  + new draft. Failed steps are never retried automatically.
- **2026-11-11** — Budget is per project and covers renders + self-checks
  (not Director chat). Estimates are charged at submit and refunded when fal
  fails the job; a render is refused up front if its projection doesn't fit,
  and a running one stops before the job that would cross it. A new plan
  inherits what earlier plans spent.
- **2026-11-11** — The production runner is ticked by the Studio (no worker
  process); an in-process per-project lock stops two tabs double-submitting.
  Production jobs stay `pending` until done so the legacy Workspace poller
  never completes them a second time.
- **2026-11-11** — Removed the Studio header's Export button (it had no handler).
- **2026-11-11** — Job cost is computed on the server from the job's inputs, not
  sent by the client; the client only supplies facts it measured (upscale
  source size and length).
- **2026-11-11** — Price drift: fal's pricing API quotes one base price, usually
  the cheapest setting, so a rule "matches" when that number is any of its
  resolution / quality / no-audio prices. A different unit is flagged for a
  manual look, not called drift.
- **2026-11-11** — Provider marks are monochrome; providers without a logo we
  can reproduce faithfully get a lettermark rather than an invented logo.
- **2026-11-11** — Studio opened to all users; the landing leads with the
  Director again (the interim *In preview* badge is gone).
- **2026-11-11** — Project Bible consistency comes from the *still*: a shot whose
  cast has reference images is rendered by a multi-reference edit model, and
  draft and final animate that still as before. No Kling Reference-to-video —
  it would need a second pipeline and the still already carries the identity.
- **2026-11-11** — A shot with a cast is priced as a reference edit even if no
  member has an image yet (quoted high, never low); the runner charges what it
  actually submits.
- **2026-11-11** — Reference portraits generated on the Bible tab are billed to
  the user's fal key at the price on the button and logged as jobs, but are not
  charged to the production budget (that covers shots, audio and self-checks).
- **2026-11-11** — Recipes are forms that seed a project (format, budget, Bible,
  structured brief), not auto-run pipelines: the cost-before-click rule means
  drafts still start from the plan's Render button.
- **2026-11-11** — `*.server.ts` modules that the client imports export only
  server functions; anything else exported there (Prisma helpers, schemas)
  is bundled into the browser. Shared schemas live in `src/lib/`.
- **2026-11-11** — No paid end-to-end Director run as a test (≈$8.50 is too
  much). Verify in `MOCK_GENERATION` mode and with single cheap live calls.
