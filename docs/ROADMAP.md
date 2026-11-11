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

### Phase 4 — Settings (mockup 6)
- [ ] Rename Profile → **Settings** (`/settings`, keep `/profile` redirecting) with left sub-nav: General · Providers · Plans & Billing · Appearance (only sections that work)
- [ ] **Providers**: fal API key card (connected / test / replace / remove) + Billing key card (exists as `FalCreditSection` — move it here); Bunny storage card
- [ ] **Usage**: current balance, monthly spend, spend chart, last 10 jobs table (model, duration, cost, status)
  - Needs a cost on every job: add `estimatedCostUsd Float?` to `GenerationJob` (and the video/image/music/3D job tables), written at submit time from `estimateCost`. fal's per-request billing API is enterprise-only, so this is our estimate.
- [ ] Low-balance threshold (stored per user) driving the credit pill's amber/red states (today hard-coded at $2 / $0.50)

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
`src/routes/api/chat.ts`. Studio is admin-only today
(`src/routes/_app/projects/$projectId.tsx`); open it up when v2 is solid.

**Done when:** "30-second coffee ad" on Home produces a priced 6-shot plan,
drafts render within budget, review lets you keep/retry, finals render and
assemble on the timeline — without typing a second message.

### Phase 6 — Polish
- [ ] Projects page + Library in the new style
- [ ] Provider icons for Krea, Ideogram, Meshy (`src/lib/model-icons.tsx`)
- [ ] Landing page / login in the new style (wordmark on login)
- [ ] Price drift check: a script or admin button comparing catalog prices to fal's pricing API

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
