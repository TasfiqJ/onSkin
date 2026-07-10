# Document 6: Guided Photo Capture & Progress Comparison — Build Spec

_The on-device, privacy-first photo-progress feature · guided capture with face-alignment + lighting checks · the ghost overlay · the before/after slider & side-by-side comparison · the weekly timeline · capture cadence · no AI scores · the "photos never leave your phone" architecture._

> This is build-order document **#6** of the 15 named in docs/00 (§"Build order", item 6: _"Guided photo capture + slider comparison"_). It is the **Progress** tab (Today · Progress · Shelf · You) and the feature docs/00 mandates shipping **FIRST, with zero AI claims**, before any cloud "skin analysis." It _extends_ the `photos` table defined in docs/01 §3, and it _implements_ the on-device capture pipeline docs/00 §4 specifies (`react-native-vision-camera` + on-device face detection via Apple Vision / ML Kit in a frame processor). It renders the spec's **guided-capture screen** (live feed + alignment overlay + lighting check + the coaching line "Turn slightly left — almost there," spec p10) and the **Progress screen** (Compare / Timeline modes, the dated slider, the weekly film strip, "13 weeks · 26 photos · all on this phone," and the honest tagline _"Same light, same angle — guided capture keeps photos honestly comparable. No scores, no AI grades,"_ spec p11). It is the **privacy-as-trust thesis made tangible** ("photos that never leave your phone," spec welcome/paywall). Capture reminders feed doc #7; the deferred Phase-2 cloud analysis is doc #12. The longitudinal photo timeline is, per docs/01 §7, the **single highest-switching-cost dataset a user can accumulate** — the compounding retention moat.

> **Current implementation boundary (2026-07-10):** the real-time and
> auto-capture language below remains target specification, not a current launch
> claim. The repo currently uses Expo Camera for a manual still, then runs
> transient on-device static-photo ML Kit face framing/pose analysis and a
> temporary downsampled luminance/balance check in review. The preview overlay
> is static, analyzer failure stays explicitly unavailable, and thresholds are
> provisional until physical-device calibration. See D-085 and the Phase 5 exit
> review.

---

## TL;DR

- **The photo feature is the app's emotional payoff and one of its strongest retention engines.** Skincare's core problem is that the work is daily and the results are slow and invisible day-to-day; the photo timeline turns that invisible work into a **before/after the user can see with their own eyes**, which is both the "aha" that sustains people through the 8–12-week results window and the privacy-as-trust thesis made tangible — _"photos that never leave your phone"_ (spec welcome/paywall).

- **It is guided, standardised, on-device, and pointedly honest — the opposite of an AI skin score.** Guided capture (a **face-alignment overlay + a lighting check + a ghost of the previous photo**) makes successive photos genuinely comparable; **on-device face detection** powers the guidance and **stores no faceprint**; and the feature carries **no AI scores or grades** by design. The spec states it outright: _"Same light, same angle — guided capture keeps photos honestly comparable. No scores, no AI grades."_

- **The science is unambiguous and is the entire rationale for guided capture.** Clinical and dermatological photography is only meaningful when **lighting, angle, distance, subject position, and skin preparation are reproduced** — the literature is blunt that _"even small variations cause a drastic change in the photos and their clinical value… unless stringent criteria are met, the photographs lose their relevance"_ (facial-aesthetic photography review; reinforced across ISIC imaging standards and clinical-trial protocols that fix distance/angle/background/illumination and require the subject "in the same position each time"). Guided capture exists to enforce that consistency on a phone.

- **Honest expectations are built in, because skin change is genuinely slow.** A full skin-cell cycle is ~28 days in your 20s, lengthening to 45–90 days with age; **most actives need at least one cycle, realistically 8–12 weeks, to show visibly** (longer for anti-aging). So the feature **captures roughly weekly and compares over a full cycle or more** (the spec's "13 weeks · 26 photos" fits ~2/week), and it is precisely the antidote to skincare's most common failure — _quitting too soon_ — which is why dermatologists explicitly recommend taking progress photos over the first months.

- **The retention case is strong and evidence-backed — and it must stay calm.** Visible progress activates intrinsic motivation (the "progress principle"; a _Journal of Consumer Research_ finding that visual progress documentation increases persistence), concretises abstract goals, and fosters the **patience** the slow timeline demands — "when people see results, they recommit"; visual feedback raises adherence by roughly a third. The honest counter-weight: a progress photo tracks an **output the user doesn't fully control** (their skin), which can breed pressure or shame, so the framing is calm — **no scores, no pressure, celebrate consistency, your own eyes** — consistent with the calm-streak design (docs/03 §6).

- **The differentiation is the honest inverse of a crowded category.** The market is racing toward **AI skin scores** — TroveSkin, SKOR (six-metric scores), L'Oréal Skin Genius, Perfect Corp, Lovi, Medgic — whose accuracy is repeatedly described as **"mixed" / "questioned,"** which publish **no independent accuracy benchmarks** (docs/00), and which typically **upload your face to servers**. A score from an uncontrolled selfie is largely lighting/angle-dependent noise dressed as objectivity. OnSkin gives **genuinely-comparable standardised photos + the user's own judgment + on-device-only** — _more_ trustworthy and _more_ valid than a dubious number, and aligned with the discerning 2026 consumer.

- **The privacy architecture is both the moat and the trust asset — and it is unusually strong.** On-device capture + on-device face detection (**no faceprint stored → avoids the BIPA biometric-identifier trigger**) + `local_only` default (**image bytes never leave the device**) + client-side encryption + separate consents + an optional biometric app-lock. Because nothing is uploaded by default, **there is no server-side face-photo trove to breach** — and vendor face-data breaches are a live 2026 risk. _You cannot leak what you never collect._ This earns the honest claim docs/00 wants: _"your photos never leave your device and never train AI."_

- **Seven-figure verdict: king-making.** It is the emotional core (the before/after that keeps people through the results window), the trust core (the privacy-as-trust feature made visible — the same engine behind Yuka's $7.3M), and the retention core (docs/01 §7 names longitudinal photos as the compounding data-lock-in moat). It powers the paywall's #3 value prop — _"Private photo timeline — on-device only."_ The honest risks — phone photos have real limits (white-light only; erythema/tone harder to read, especially in darker skin) and progress tracking can create pressure — are addressed head-on by honest framing, no AI scores, and calm design.

---

## Key Findings

1. **The photo timeline is the emotional payoff and a top retention/lock-in surface.** It makes invisible progress visible (the Progress tab; paywall prop #3), and docs/01 §7 explicitly identifies longitudinal photos as the compounding switching cost behind retention. This is the feature that converts a routine tracker into something a user is emotionally invested in keeping.

2. **Standardised photography is the science, and consistency is everything.** Reproducing lighting, angle, distance, subject position, and skin prep is what makes a before/after meaningful; _"even small variations cause a drastic change in the photos and their value"_ (facial-aesthetic photography review; ISIC Standards for Dermatological Imaging; clinical-trial protocols fixing distance/angle/background/illumination and requiring the same position each time, viewing each shot against its baseline). Guided capture enforces this on a phone.

3. **On-device face detection fully solves the guidance, with no cloud.** Apple Vision (`VNDetectFaceLandmarksRequest` → `boundingBox`, `landmarks`, `roll`/`yaw`/`pitch`, `faceCaptureQuality`) and Google ML Kit (`Face` bounding box, `getHeadEulerAngleX/Y/Z()`, contours), run via `react-native-vision-camera-face-detector` in a frame processor, give real-time alignment, head-tilt, and distance checks; average luminance/white-balance from the frame buffer gives the lighting check (docs/00 §4). All on-device.

4. **Skin change is slow, so the feature sets honest expectations and compares over meaningful intervals.** Cell cycle ~28 days (20s) → 45–90 days (older); visible results typically **8–12 weeks**, up to six months for anti-aging. Capture ~weekly, compare across a cycle+; the photo is the antidote to _quitting too soon_ (dermatologists explicitly recommend progress photos over the first months).

5. **Progress photos are a multi-mechanism behaviour-change and retention tool — kept calm.** Visible progress drives intrinsic motivation (the "progress principle"; _Journal of Consumer Research_), concretises abstract goals, and builds patience; visual feedback lifts adherence ~30%; "see results → recommit." Honest caveat: tracking an output one doesn't control can create pressure/shame, so keep it calm — no scores, celebrate consistency, your own eyes (docs/03 §6).

6. **The category is AI skin scores; the honest inverse is the differentiation.** TroveSkin, SKOR, Skin Genius, Perfect Corp, Lovi and others score faces (accuracy "mixed/questioned," no published benchmarks, faces uploaded to servers). OnSkin gives standardised, genuinely-comparable photos + the user's own eyes + **no AI scores** + **on-device** — more trustworthy and more valid than a score from an uncontrolled selfie.

7. **Facial images are legally sensitive — but OnSkin's design avoids the worst exposure.** Facial images are sensitive under BIPA/CCPA-CPRA/GDPR Art. 9/MHMDA, _especially when a faceprint is extracted for identification_ (Finnegan, on cosmetics AI facial analysis). OnSkin stores **no faceprint** (on-device framing only) → it avoids BIPA's biometric-identifier trigger; skin photos still reveal health status → treated as Art. 9 / MHMDA data requiring **explicit, unbundled consent** (docs/01 §4).

8. **On-device/`local_only` storage eliminates the breach target.** Because image bytes never leave the device by default, there is **no server-side face-photo trove** to leak — a decisive security and trust advantage over the upload-to-server AI-score apps; vendor face/biometric breaches are a real 2026 risk. _You cannot leak what you never collect._

9. **Phone photos have honest limits, which reinforce the no-AI-score stance.** Phone cameras use white light (no cross-polarisation), so **erythema and subtle tone changes are harder to judge — particularly in darker skin** (BJD, standardised photography across skin tones). This argues for _your own eyes_ over a false-precision score and for fairness care (Monk Skin Tone scale, docs/00/01).

10. **Capture cadence and reminders are calm and opt-in.** Weekly default, comparison over a cycle+, tied to the skin cycle (docs/05) and the user's goals; a gentle "time for a progress photo" nudge (timing decided with the scheduler, delivered by doc #7's reminders), at a consistent time of day for comparability — never pressuring, a missed week never punished.

---

## Details

### 1. What the feature is — and is not (scope & philosophy)

**It is** the guided, standardised, on-device photo-progress feature. Concretely, it:

- captures **standardised** facial photos with real-time **guidance** (alignment, distance, head-tilt, lighting) so successive photos are comparable;
- stores them **on-device** (privacy-first) and encrypted; cloud backup is a future target, not a current V1 capability;
- presents an **on-device timeline** and a **before/after slider + side-by-side comparison** (the Progress tab);
- is the **emotional payoff** of the app and a primary retention surface;
- ships **Phase 1 with no AI claims** (docs/00).

**It is not**, and these boundaries are load-bearing:

- **not an AI skin-score / analyzer** — explicitly, at launch (docs/00); it gives no number, grade, or "skin age."
- **not a diagnostic or medical-device tool** — it never diagnoses or claims to detect conditions; it is a personal record (claim-safe, docs/02 §9).
- **not a cloud face-upload service** — current V1 storage is device-only unless the user explicitly shares one photo.
- **not a faceprint/biometric-identification system** — on-device face detection is for _framing only_; no template is ever stored (BIPA avoidance, docs/00/01).

**Philosophy: honest, calm, your-own-eyes, private.** The feature's credibility comes from _not_ overclaiming: it shows you genuinely-comparable photos and lets you judge, it acknowledges phone-photo limits, it never scores you, and it never moves your face off your device without explicit permission. This is the brand's anti-hazard-score, privacy-as-trust thesis applied to the most sensitive data the app touches.

> **Current implementation boundary (D-086):** encrypted cloud backup is not
> shipped. Current builds expose no backup setter or actionable switch, remove
> stale local enablement at startup, and perform no automatic Supabase image or
> photo-metadata insert from local save. Settings and locked Progress show
> device-only storage. The cloud consent type, private bucket, and schema below
> are reserved target-state scaffolding only; they must not be described as a
> working feature until encrypted upload, retry, restore, deletion, reviewed
> consent, and physical-device QA ship together.

### 2. The science of valid progress photography (the guided-capture rationale)

**Standardisation is everything.** Clinical photography is only comparable when the capture conditions are reproduced. Across the literature and clinical-trial protocols, the controlled variables are: **lighting** (consistent, even, diffuse — _not_ direct), **angle** (fixed frontal/oblique/lateral views), **distance** (constant — camera distance and angle measurably change photographed skin appearance over time, Vanderbilt/PubMed), **subject position** ("the subject will be placed in the same position each time… each photograph viewed to ensure it is similar to its baseline counterpart in lighting, distance and angle"), **skin preparation** (cleansed, no makeup), and **background**. The blunt summary from a facial-aesthetic photography review: _"even small variations cause a drastic change in the photos and their clinical value… unless stringent criteria are met, the photographs lose their relevance."_ The ISIC **Standards for Dermatological Imaging** (Delphi consensus) and Halpern's standardised poses formalise this. **Guided capture is the home-phone implementation of these standards** — it cannot match a clinic, but it can hold the controllable variables (alignment, distance, head-pose, lighting consistency, skin prep, time of day) far steadier than an unguided selfie.

**An honest limit — white light vs cross-polarisation.** Clinics often use cross-polarised light to reduce glare and reveal erythema/subsurface detail; phones use white light, under which **erythema and subtle tone changes are harder to see — especially in darker skin** (BJD, standardised photography across skin tones: erythema is "less visible particularly in darker skin tones with conventional white-light photography"). The feature therefore (a) focuses on what white-light phone photos _do_ show well (texture, breakouts, overall change over time), (b) treats **tone/redness comparisons with humility**, (c) adopts the **Monk Skin Tone** scale for any tone reference (docs/00/01, fairness), and (d) uses this limit as one more reason to give _your own eyes_ rather than a false-precision score.

**Realistic timelines (honest expectation-setting).** Cell turnover is ~28 days in your 20s, 35–40 in your 30s, 45–60 in your 40s, 60–90+ beyond — so **most actives need at least one full cycle, realistically 8–12 weeks, before visible change** (vitamin C: brightness ~4 weeks, pigmentation 8–12; retinoids 8–12 weeks, up to 6 months; hyaluronic acid is the immediate exception). The feature reflects this by comparing over **a cycle or more**, capturing ~weekly, and setting expectations that change is gradual — which is exactly how a progress photo earns its keep: it shows the slow change the mirror hides, so the user keeps going.

**The limits, stated plainly (so the feature stays honest).** Even guided home photos can mislead (residual lighting/angle variance, camera differences, time-of-day skin state). The feature therefore never asserts an objective delta, never scores, and frames comparisons as _"honestly comparable,"_ not _"proof."_ Consistency is maximised, not faked.

### 3. Guided capture — how it works (the hero flow, every detail)

**The capture screen (spec p10, dark).** A full-bleed **live camera feed** (`react-native-vision-camera`) on the night palette; minimal chrome; the on-device privacy microcopy ("Scanning happens on your device"). Dark UI keeps the user's face the brightest thing on screen and is the spec's choice for capture.

**On-device face detection (the guidance engine).** A frame processor runs **on-device** face detection (`react-native-vision-camera-face-detector`, ML Kit-backed on both platforms; or a custom Swift plugin wrapping Apple Vision `VNDetectFaceLandmarksRequest` for iOS), surfacing per frame: the **bounding box** (→ distance/scale), **landmarks** (→ alignment to the reference), **head-pose** (`roll`/`yaw`/`pitch` or ML Kit Euler angles → tilt/turn), and **capture quality** (`faceCaptureQuality`). **No faceprint/template is computed or stored** — these signals drive the overlay in real time and are discarded.

**The alignment overlay.** Composited over the live feed:

- a **ghost of the previous (reference) photo** at low opacity, so the user literally lines their face up with last time (the core consistency mechanism);
- a **face-alignment guide** (an outline / landmark target) showing where to position the face;
- a **real-time coaching line** that responds to the detection — the spec's _"Turn slightly left — almost there"_ — cycling through plain, calm instructions ("Move a little closer," "Lower your chin," "Hold still");
- a **distance/scale indicator** (face fills the frame to match the reference);
- a **head-tilt/level indicator** (roll/pitch within tolerance).

**The lighting check.** From the frame buffer, compute **average luminance and white-balance on-device**; show a calm **"Lighting"** indicator — the spec's _"Lighting: Good"_ — with states like _Good / Too dark / Too warm / Uneven_, and gentle guidance toward consistent, even, diffuse light (ideally daylight, facing a window, no harsh direct source), matching the reference photo's conditions where known.

**Skin-prep prompt.** On the first capture and in reminders, a brief, calm prompt: clean skin, no makeup, hair back, **same time of day** as before (skin state varies across the day) — the controllable prep variables from §2.

**The capture moment.** When alignment + distance + head-pose + lighting are all within tolerance, the UI signals "ready" (the guide turns calm-clay) and either **auto-captures** (the recommended default — removes the hand-shake of tapping) or enables a manual shutter. A **selection/confirmation haptic** fires on capture. The captured frame is held for review.

**Review & retake.** The captured photo is shown with its computed **alignment_score** and **lighting_score** (docs/01) and a calm quality note ("Nicely matched to last time" / "A little darker than usual — retake?"). **Retake** is one tap; **save** stores it on-device (§6). Low quality is **flagged, never blocked** — the user is always in control (D-029).

**The reference / baseline.** The **first photo of a given angle/zone** becomes the reference; every subsequent capture aligns to it (the ghost overlay) so the _series_ is internally consistent. The reference can be re-set if the user wants a fresh baseline (e.g., after a haircut or a new phone).

**Angles & zones (optional, consistency per series).** Default is a single **frontal** capture. Power users can add **oblique (left/right)** views or **zones** (full-face, a cheek, the forehead) for targeted concerns; each angle/zone is its own series with its own reference and ghost. Consistency is maintained _within_ each series.

**Edge cases (all handled calmly):**

- **No face detected / multiple faces** → "Center your face in the guide"; don't capture.
- **Lighting can't be fixed** (genuinely dark room) → guidance + allow capture with a quiet "this one's darker than usual" note (honesty over blocking).
- **Permission denied** → a calm explainer of why the camera is needed and that capture is on-device; deep-link to settings.
- **Low device storage** → warn before capture; photos are compressed (~150–400KB, docs/00).
- **Front vs rear camera** → default front (selfie) for face; consistent across the series.

### 4. The photo timeline & comparison — how it looks (the Progress tab, every detail)

**The Progress screen (spec p11, the Progress tab).** Top to bottom:

- **Title** "**Progress**" (Instrument Serif) with a mono metadata line — _"13 weeks · 26 photos · all on this phone"_ — which doubles as a quiet privacy reassurance ("all on this phone").
- **The honest tagline**, prominent and calm: _"Same light, same angle — guided capture keeps photos honestly comparable. No scores, no AI grades."_
- A **mode switch: Compare / Timeline.**
- **Tab bar:** Today · Progress · Shelf · You (Progress active, clay dot).

**Compare mode (the before/after slider).** Two photos overlaid with a **draggable vertical divider** (the slider): drag left/right to wipe between **before** and **after**. Above/below, **dated chips** name the two photos — the spec's _"Mar 12"_ and _"Jun 12."_ Tapping a chip opens a date picker / film-strip to choose **any two captures** to compare (default: first vs latest, or a one-cycle interval). A **side-by-side** toggle places the two photos adjacent instead of overlaid (better for some comparisons and for accessibility). The slider is a smooth gesture (Reanimated) with a clipping reveal (Skia/clip-path); a subtle haptic at the endpoints. **No numbers, no AI overlay, no "improvement %"** — just the two photos and their dates.

**Timeline mode (the weekly film strip).** A chronological **film strip / grid** of thumbnails grouped by **week/month**, scrubbable through time; tap any thumbnail for the single-photo detail. Optional **milestones** marked calmly (first photo, 4 weeks, one cycle, 12 weeks) — _not_ gamified, no points; just gentle markers of how far the user has come. A "play" affordance can flip through the series as a quiet time-lapse.

**Single-photo detail.** One photo with its **date**, the **alignment/lighting quality** notes, optional **user notes** ("started new retinol," "breakout from travel"), and actions: set as reference, share (with optional redaction, §7), **delete**. All on-device.

**States.** **Empty** → a warm prompt: "Take your first photo — we'll guide you, and it stays on your phone." **Sparse (one photo)** → "Take another in about a week to start comparing." **Loading** → skeleton thumbnails. **Comparison with only one photo** → invite a second rather than showing an empty slider.

**Microcopy, motion, haptics, accessibility, localisation.**

- **Microcopy:** honest, calm, no-scores, claim-safe ("honestly comparable," "your progress, on your phone"); never "your skin improved 23%," never "skin age."
- **Motion:** the slider wipe, the ghost fade-in on capture, gentle thumbnail transitions; **Reduce Motion** → cross-fades, no time-lapse autoplay.
- **Haptics:** capture confirmation, alignment-locked tick, slider endpoints; nothing alarming.
- **Accessibility (a genuinely hard surface — handled deliberately):** the camera guidance provides **audio + haptic cues** (spoken "almost there," a distinct haptic when aligned) so capture isn't purely visual; VoiceOver on the timeline announces **dates and capture quality** ("June 12, well-lit, aligned"), **never a judgment of the skin**; the slider exposes an accessible value (position/date) and the side-by-side mode is the accessible-preferred comparison; Dynamic Type for all labels. _We acknowledge a visual progress feature is inherently less useful to a blind user — the honest goal is to make capture and navigation fully operable, not to pretend the comparison is non-visual._
- **Localisation:** dates, week/month grouping, and all copy externalised for ~30% expansion + RTL (the slider mirrors correctly in RTL).

### 5. Capture cadence & reminders

- **Default cadence: ~weekly.** Frequent enough to build a meaningful timeline and catch change, infrequent enough to avoid day-to-day noise (skin fluctuates daily); comparisons default to **a full cycle or more** (4–6+ weeks) where visible change actually accrues (§2). The spec's "13 weeks · 26 photos" implies roughly twice-weekly — a fine upper bound for keen users.
- **Tied to the skin cycle and goals** (docs/05): e.g., a gentle nudge aligned to cycle milestones, or to the ramp/goal the user set.
- **The reminder:** a calm _"Time for a progress photo?"_ nudge whose **timing is decided with the scheduler (docs/05)** and **delivered by doc #7's reminders** (gated by `notification_preferences`), fired at a **consistent time of day** for comparability. It is **opt-in, skippable, and never pressuring**; a missed week never breaks anything (the calm-streak ethos, docs/03 §6). Photos are deliberately _decoupled_ from the daily check-off streak — they are a slower, gentler cadence.

### 6. Data model — extends docs/01 `photos`

**Recap of the existing `photos` (docs/01 §3) — the privacy-first spine:** `id`, `user_id`, `storage_path text NULL` (**NULL when local-only**), `taken_at`, `lighting_score numeric`, `alignment_score numeric`, `local_only bool DEFAULT true`, `face_region_redacted bool`. **No faceprint/biometric template is ever stored.** Owner-only RLS; private Storage bucket scoped by `(storage.foldername(name))[1] = (select auth.uid())::text`.

**Extensions this feature needs** (additive; the image bytes still live on-device unless cloud-opted):

```sql
alter table public.photos
  add column reference_photo_id uuid references public.photos(id) on delete set null, -- the baseline this aligns to
  add column series             text not null default 'front', -- 'front' | 'left' | 'right' | 'cheek_l' | 'forehead' | ...
  add column capture_session_id uuid,            -- groups a multi-angle session
  add column head_roll  numeric, add column head_yaw numeric, add column head_pitch numeric, -- pose at capture (QA; not a faceprint)
  add column taken_local_date date not null,     -- local day, for cadence/comparison (D-012 tz handling)
  add column time_of_day text,                   -- 'morning' | 'evening' (consistency hint)
  add column notes      text,                    -- "started retinol", "travel breakout"
  add column local_uri  text,                    -- on-device encrypted file path (never synced)
  add column is_encrypted boolean not null default true;
create index on public.photos (user_id, series, taken_local_date);
-- Owner-only RLS unchanged (docs/01 §3). head_* are coarse pose angles for alignment QA — NOT a biometric template.
```

**On-device storage & encryption.** Image bytes are written to the **app's private sandbox**, **client-side encrypted** (docs/00 §7), referenced by `local_uri`, and current local saves do not upload image bytes or metadata. The **gallery is gated by an opt-in biometric app-lock** (`expo-local-authentication`, docs/01) — Face ID/Touch ID to open the Progress tab. **Future target only:** a complete cloud-backup implementation would set `storage_path`, upload the client-side encrypted image to the private bucket on a queued Wi-Fi/charging job (docs/00 §6), require separate `photo_cloud_backup` consent, restore across devices, and delete remote objects and metadata. None of that path is exposed in current V1.

> **Decision-log notes (DECISIONS.md):** **D-028** — photos are **`local_only` by default**, **client-side encrypted**, and **no faceprint is ever computed/stored** (on-device face detection for framing only); **D-029** — guided-capture **quality is scored (`alignment_score`/`lighting_score`) and surfaced, but low quality is flagged, never blocked** — the user always controls capture; **D-030** — **no AI scoring/grading at launch**; any Phase-2 cloud analysis (doc #12) is a separate, consented, fairness-validated service and is **off** until then. Anything touching the facial-image DPIA, the consent copy, and the "never leaves your device" marketing claim belongs in **BLOCKERS.md** under **B-PRIVACY**.

### 7. Privacy & compliance (the heart of this feature) — extends docs/00 §7, docs/01 §4

Facial images are the most sensitive data the app handles, and this feature's design is built to minimise that exposure rather than manage it after the fact.

- **The legal landscape.** Facial images are sensitive under **BIPA, CCPA/CPRA, GDPR Art. 9, and Washington MHMDA**, and become **biometric identifiers** specifically when a **faceprint/template is extracted for identification** (Finnegan, on cosmetics AI facial-skin-analysis: facial images processed for analysis/identification "may be treated as biometric data… requiring more onerous legal obligations"; BIPA requires written informed consent, retention schedules, no sale, and carries a **private right of action**).
- **OnSkin's posture avoids the worst trigger.** On-device face detection is **for framing only**; **no faceprint/template is ever computed or stored** → this avoids BIPA's biometric-identifier trigger (docs/00 §7, docs/01 §3). The coarse `head_*` pose angles are alignment QA, not an identification template.
- **But skin photos are still health-inference data**, so current capture requires dedicated **`photo_capture` consent at first camera use**. The reserved **`photo_cloud_backup` consent** remains unwired until a future complete backup path is reviewed because uploading special-category images off-device is higher-risk (docs/01 §4).
- **`local_only` eliminates the breach target.** Because image bytes never leave the device by default, **there is no server-side face-photo trove to breach** — the strongest possible posture for face data, and a direct contrast with the AI-score apps that upload faces to servers (vendor face/biometric breaches are a live 2026 risk). _You cannot leak what you never collect._
- **Defense in depth:** client-side **encryption**; **owner-only RLS** + private bucket (folder = uid) for any future cloud-opted photos with **signed URLs**; the optional **biometric app-lock** on the gallery; the mobile **export** includes sanitized local photo metadata and decrypted notes when available but excludes image bytes, thumbnails, device paths, note ciphertext, and key material, while any valid owned server-side photo rows can carry short-lived signed URLs (GDPR Art. 20, docs/01 §4); **deletion** cascades and removes any cloud objects (Apple/Google in-app deletion requirements, docs/01 §4); an optional **`face_region_redacted`** crop/blur for sharing a photo without the full face.
- **The earned claim.** This architecture is what lets the brand honestly say _"your photos never leave your device and never train AI"_ (docs/00) — the privacy-as-trust promise on the welcome and paywall screens, made real rather than asserted.

### 8. No AI scores — the honest, differentiating stance

**The feature deliberately gives no AI skin score or grade at launch** (Phase 1, docs/00). The reasoning is both ethical and strategic:

- **AI skin scores are not validated.** Commercial skin-analysis vendors publish **no independent accuracy benchmarks** (docs/00), and consumer AI-score apps' accuracy is repeatedly described as **"mixed" / "questioned"** (TroveSkin reviews; the broader roundups). A score derived from an **uncontrolled selfie** is heavily confounded by lighting/angle — _false precision dressed as objectivity._
- **Scores invite anxiety and shame.** A number to go up or down turns a calm progress record into a judgment; this is exactly the pressure/shame failure mode the behavioural literature warns about and the brand's calm ethos rejects (docs/03 §6).
- **Facial-analysis fairness is unresolved.** Facial algorithms have documented accuracy gaps across skin tones and genders (ACLU on facial recognition; the white-light erythema limit, §2) — another reason not to stake user trust on an automated grade.
- **OnSkin's inverse is more honest _and_ more valid.** Standardised, genuinely-comparable photos + the user's own eyes beat a dubious number — and, because capture is standardised, OnSkin's before/after is _more_ trustworthy than a score computed from an unguided photo. The spec says it: _"No scores, no AI grades."_

**The deferred Phase-2 path (door open, firmly shut at launch).** docs/00's phased-AI plan leaves room to add cloud analysis later — but only **behind a separate consent gate, with fairness validation, honest grading, and never a hazard-style score** (that is **doc #12**, "AI trend analysis," the last build item). This document's stance is that the photo feature is **complete and compelling without any AI**, and that shipping it AI-free first is the trustworthy sequencing docs/00 prescribes.

### 9. UI / UX details (consolidated — look, feel, behaviour)

Design tokens (docs/00 §8, D-005, docs/02 §7): Instrument Serif (the "Progress" title), Hanken Grotesk (UI), monospace (metadata, dates, "13 weeks · 26 photos"); palette paper · greige · clay · ink · night; **capture is dark**, the timeline/compare can be light or dark per context; 8pt grid; Reanimated 3 + Skia motion; restrained haptics; WCAG 2.2 AA; Dynamic Type; RTL-ready.

- **Capture screen (dark):** live feed · ghost overlay · face-alignment guide · real-time coaching line ("Turn slightly left — almost there") · lighting indicator ("Lighting: Good") · ready-state (guide turns clay) · auto/manual shutter · torch · on-device privacy microcopy · capture haptic.
- **Review:** captured photo · quality note · Retake / Save.
- **Progress tab:** title + "13 weeks · 26 photos · all on this phone" · the honest tagline · **Compare** (slider + dated chips + side-by-side toggle) · **Timeline** (weekly film strip + calm milestones + quiet time-lapse) · single-photo detail (date, quality, notes, set-reference, share-with-redaction, delete).
- **Voice:** honest, calm, no-scores, claim-safe.
- **Accessibility:** audio + haptic capture cues; VoiceOver announces dates/quality, not skin judgments; side-by-side as the accessible comparison; accessible slider value.

### 10. Engineering / implementation notes

- **Capture pipeline:** `react-native-vision-camera` + a **face-detection frame processor** (`react-native-vision-camera-face-detector`, ML Kit; or a custom Swift Vision plugin on iOS) for alignment/pose/quality; **on-device luminance/white-balance** from the frame buffer for the lighting check; **auto-capture** when all tolerances are met; the **ghost overlay** composited over the preview (docs/00 §4).
- **Comparison UI:** the **slider** as a Reanimated gesture with a Skia/clip-path reveal; the **film strip** as a virtualised list; the optional time-lapse as a frame sequence.
- **Storage:** **on-device encrypted files** in the app sandbox (`local_uri`); compressed ~150–400KB each, ~50–200/user/year (docs/00). A future cloud implementation may use the private Supabase bucket on a Wi-Fi/charging queue, with Cloudflare R2/S3 behind signed URLs as a scale fallback, but current V1 exposes no backup path.
- **Security:** client-side encryption; biometric app-lock (`expo-local-authentication`) on the gallery; owner-only RLS; signed URLs for any cloud photo.
- **Schema & decisions:** the `photos` extensions above; **D-028/029/030**; **B-PRIVACY** (DPIA, consent copy, legal sign-off of the "never leaves your device" claim).
- **PostHog instrumentation — metadata only, never image data:** current `photo_captured` sends only the on-device flag; quality scores/verdicts are excluded. `first_photo_captured`, `photo_baseline_added`, `comparison_viewed`, `timeline_viewed`, `capture_reminder_tapped`, and `reference_reset` remain content-free activation signals. `cloud_backup_opted_in` is reserved and must not be emitted while backup is unavailable.
- **Performance:** the frame processor must sustain a smooth preview (the docs/00 spike validates `vision-camera` frame-processing on-device; if it underperforms, isolate the camera module — docs/00's fallback note); comparisons and the timeline are local and fast.

---

## Seven-Figure Validation (the photo feature & the money)

The photo feature sits at the intersection of emotion, trust, and retention — the three things a subscription skincare app most needs:

- **It is the emotional payoff that sustains retention through the results window.** Skincare results take 8–12 weeks; most people quit before they see them. The photo timeline shows the slow change the mirror hides, fostering the **patience** that converts trials into long-term subscribers — "when people see results, they recommit," and visual feedback lifts adherence ~30%. docs/01 §7 names **longitudinal photos as the compounding switching cost** behind retention; a multi-month face timeline is the **highest-lock-in dataset a user can accumulate** (irreplaceable if they leave).
- **It powers the paywall's #3 value prop and is its most emotionally resonant promise.** _"Private photo timeline — on-device only"_ (spec p7) is both a feature and a trust statement; the before/after is the demo that makes the value visceral.
- **Privacy-as-trust is a direct monetisation and word-of-mouth engine.** Yuka earned **$7.3M (98.1% from subscriptions), zero marketing, on trust in its data refusal** (docs/01 §7); for an app handling **face photos**, the on-device/no-faceprint/no-upload posture is an even stronger trust asset — and the explicit contrast with apps that upload your face to servers is a sharp marketing wedge.
- **The honest, no-AI-score stance is a defensible position in a crowded, dubious category.** The market is flooded with AI-skin-score apps of "mixed/questioned" accuracy and no published benchmarks; OnSkin's _standardised, comparable, your-own-eyes, on-device_ approach is the trustworthy alternative the discerning 2026 consumer is moving toward ("apps transparent about data practices earn more trust"; "an app that explains what it measures beats AR filters and gamification").
- **It deepens every other surface.** Photos give the routine (docs/03), the scheduler (docs/05), and future recommendations something concrete to anchor to ("you've been consistent for 8 weeks — here's your timeline"), reinforcing the whole habit loop.

**Verdict: yes — the guided photo-progress feature is a seven-figure, king-of-the-category feature.** It is the emotional core (the before/after that keeps people through the slow results window), the trust core (the privacy-as-trust promise made real on the most sensitive data the app holds), and a top retention/lock-in surface. The honest risks — phone photos have real limits (white-light, harder for erythema/tone in darker skin), and progress tracking can create pressure — are met head-on by honest framing, **no AI scores**, fairness care, and calm design. Built this way, it is the feature users fall in love with and the one that makes leaving feel like losing their own history.

---

## Synthesis

**(a) What it is:** the guided, standardised, on-device, no-AI-score photo-progress feature — the Progress tab — that turns invisible skincare work into a visible, private before/after. Phase 1 ships with zero AI claims (docs/00).

**(b) The science:** progress photos are only meaningful if lighting/angle/distance/position/prep are reproduced ("small variations drastically change a photo's value"); guided capture is the home-phone implementation of clinical photography standards, with an honest white-light limit (erythema/tone in darker skin) and realistic 8–12-week change timelines.

**(c) Guided capture:** on-device face detection (Vision/ML Kit via a vision-camera frame processor) drives a ghost overlay + alignment/distance/head-pose guide + real-time coaching + an on-device lighting check; auto-capture when aligned; review/retake; a per-series reference; no faceprint ever stored.

**(d) Timeline & comparison:** the Progress tab's Compare (before/after slider + dated chips + side-by-side) and Timeline (weekly film strip + calm milestones), with the honest "no scores, no AI grades" tagline, all on-device.

**(e) Cadence:** ~weekly capture, comparison over a cycle+, a calm consistent-time reminder (scheduler-timed, doc #7-delivered), opt-in and never pressuring; decoupled from the daily streak.

**(f) Data model & privacy:** extends docs/01 `photos` (reference, series, pose QA, local encrypted URI); `local_only` default + client-side encryption + no faceprint → avoids BIPA's trigger and leaves **no server breach target**; separate capture/cloud consents; biometric app-lock; export/deletion/redaction.

**(g) No AI scores:** a deliberate honest stance — scores are unvalidated, lighting-confounded, anxiety-inducing, and fairness-fraught; standardised photos + your own eyes are more honest and more valid; Phase-2 AI (doc #12) stays gated and off at launch.

**(h) Composition & confidence:** the Progress tab composes with docs/01 (schema, consents, app-lock, activation), docs/00 (on-device stack, privacy architecture, phased AI), docs/03/05 (the routine/cycle the photos track), and doc #7 (reminder delivery); the facial-image privacy work (B-PRIVACY) is the load-bearing item, and the honest framing is the design constraint.

---

## Recommendations

1. **Ship guided capture + the slider/timeline with zero AI claims, on-device-first** — exactly the sequencing docs/00 prescribes; it is complete and compelling without AI.
2. **Make guided capture genuinely standardising** — the ghost overlay, alignment/distance/head-pose guide, real-time coaching, and the on-device lighting check — because comparability is the entire value (and validate frame-processor performance early, per docs/00's spike).
3. **Auto-capture when aligned, flag (never block) low quality** (D-029), and keep the user in control.
4. **Default to `local_only` + client-side encryption + no faceprint** (D-028); gate the gallery with an opt-in biometric app-lock; keep cloud backup unavailable until a complete separately consented implementation passes D-086.
5. **Set honest expectations and compare over a cycle+** — capture ~weekly, frame change as gradual (8–12 weeks), and use the photo as the antidote to quitting too soon.
6. **Keep it calm and score-free** (D-030): no numbers, no "skin age," celebrate consistency, your own eyes — and decouple photos from the daily streak.
7. **Be honest about phone-photo limits** — white-light only, tone/erythema harder to judge especially in darker skin — and adopt the Monk scale for any tone reference (fairness).
8. **Treat the privacy architecture as the headline trust asset** — earn the "photos never leave your device, never train AI" claim, contrast explicitly with upload-to-server apps, and run the DPIA + consent/marketing-claim legal review (B-PRIVACY).
9. **Make capture and navigation fully accessible** (audio + haptic alignment cues; VoiceOver announces dates/quality not skin judgments; side-by-side as the accessible comparison) while honestly acknowledging a visual feature's limits.
10. **Position it as the honest, private progress tracker** in a category of dubious AI scores — and as the emotional payoff that makes the whole subscription worth keeping.

---

## Caveats (confidence flags)

- **Guided capture maximises consistency but cannot fully standardise a home environment** — residual lighting/angle/camera variance remains, so frame comparisons as "honestly comparable," never as objective proof. _High confidence on the direction; do not overpromise clinical-grade comparability._
- **Phone photos are white-light only** (no cross-polarisation), so erythema and subtle tone changes are harder to judge — **especially in darker skin** — which both limits what the feature should claim and reinforces the no-AI-score stance and Monk-scale fairness care. _High confidence on the limit._
- **Skin-change timelines are slow and individual** (8–12 weeks typical, longer with age/anti-aging); set expectations accordingly and compare over a cycle+, not day-to-day. _High confidence._
- **Progress tracking can create pressure or shame** when it tracks an output the user doesn't fully control; the calm, no-scores, consistency-celebrating framing (and decoupling from the daily streak) is a design requirement, not a nicety. _High confidence — this is load-bearing._
- **The no-AI-score stance is a deliberate choice competitors will pressure** (they tout scores as "objective"); hold the line — the scores are unvalidated, lighting-confounded, and fairness-fraught, and the honest position is the more durable trust asset. _Medium-high confidence; revisit only if a credible, consented, fairness-validated analysis becomes possible (doc #12)._
- **Facial images are legally sensitive**, and although the no-faceprint + on-device design avoids BIPA's worst trigger, the DPIA, the unbundled consents, and the "never leaves your device" marketing claim require legal sign-off (B-PRIVACY); the claim must be literally true in implementation. _High confidence that this review is required._
- **On-device-only storage carries a device-loss / no-backup tradeoff** — the most private option also means a lost phone can mean lost photos. Current V1 surfaces that limitation instead of claiming an incomplete backup. A future complete opt-in backup could mitigate loss but would re-introduce a consented, encrypted breach surface. _High confidence on the tradeoff being real._
- **On-device face-detection/frame-processor performance must be verified on real devices** (docs/00 flags isolating the camera module if RN underperforms); auto-capture tolerances need device tuning. _Medium confidence pending device testing._
- **A visual progress feature is inherently less useful to blind/low-vision users**; the honest goal is fully operable capture/navigation (audio + haptic cues, accessible timeline), not pretending the comparison itself is non-visual. _High confidence; an honest accessibility limit._
- **The AI-skin-score competitive race continues** (TroveSkin, SKOR, Skin Genius, Perfect Corp, and new entrants); the defensible wedge is the **honest, standardised, on-device, your-own-eyes** combination plus the privacy posture, revisited periodically. _Medium confidence._
