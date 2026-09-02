# Nightjar — Project Scope

**Hackathon:** NextStep Hacks 2026 · *Earth Forward*
**Team:** Green Sapiens · Year 1 undergraduates
**Deadline:** Sun 13 Sep 2026 — **we submit Sat 12 Sep**
**Written:** 2 Sep 2026 · Replaces the earlier solar-calculator scope

---

## 1. What we're building

**A bird-collision risk map and advisory for Singapore.**

Enter a location → get a collision risk score → get a specific, actionable recommendation.

That's it. One sentence, one screen, one clear output. Everything below serves that.

### Why this problem

- Singapore is the **most light-polluted country on Earth** — 100% of the population lives under skies too bright for the eye to dark-adapt.
- Singapore sits on the **East Asian–Australasian Flyway**, one of the world's most threatened migration routes.
- Peer-reviewed local research found that for **migratory** birds, collision risk tracks building density and **blue-rich** nocturnal light; for **residents**, it tracks woodland proximity. Collisions peak in **October–November**.
- Bird deaths from man-made structures in Singapore are at a record high.

We didn't discover any of this. We're turning a published academic finding into something a Town Council can actually use.

---

## 2. Scope reality check

We are four first-year undergraduates with about **ten days and classes**. Realistic team capacity is roughly 45 hours total.

That rules out — and we are not building — any of:

- Bird migration forecasting
- Acoustic monitoring or audio ML
- Satellite imagery processing
- Camera photometry, spectrometry, or exposure calibration
- Any machine-learning model we train ourselves
- A backend, database, or user accounts

Each of those was considered and cut deliberately. They are research projects, not ten-day projects.

**What we optimise for instead:** finishing something polished, well-explained, and grounded in real local data. Four of the six judging criteria — Completion, Learning, Design, Technology — reward exactly that. Learning is explicitly graded relative to our level.

---

## 3. Architecture — three layers, each optional

The critical rule: **the app must be fully useful with zero user input.** Layers 2 and 3 enrich it; nothing depends on them.

### Layer 1 · Base map (works immediately, no users)

Built entirely from public data:

| Source | Provides |
|---|---|
| NParks boundaries (data.gov.sg) | Parks, reserves, park connectors — the habitat edges |
| VIIRS nighttime lights | Baseline light levels across the island |
| OneMap SG | Address search, building footprints |

Risk score = **habitat proximity × light level × building density**, weighted per the published findings. Renders as a coloured map that highlights the edge zones where risk concentrates.

### Layer 2 · Lamp photos (refines the map)

Photograph a light → the app reads its average colour → classifies it:

| Appearance | Type | Bird risk |
|---|---|---|
| Deep orange | Sodium ~2000K | Low |
| Yellowish white | Warm LED 2700–3000K | Low |
| Plain white | Neutral LED ~4000K | Medium |
| Blue-white glare | Cool LED 5000–6500K | **High** |

Technically this is reading average pixel colour on a `<canvas>` — roughly 30 lines of JavaScript. No calibration, no white-balance fight, no photometry. A blue-white lamp pinned near a reserve edge becomes a high-priority flag.

### Layer 3 · Collision reports (builds evidence)

A simple form: location, date, optional photo. Stored in browser localStorage for the demo; seeds a dataset and demonstrates the long-term concept.

### Output — the actual product

For any location: a **risk score**, the **reason** in plain language, and a **recommendation**:

- *Warm or shield this lighting* — cheapest fix
- *Dim during October–November* — free, reversible, seasonal
- *Bird-safe glass treatment* — as NParks already runs at Sungei Buloh, HortPark and the Botanic Gardens

Plus which agency owns that type of light: URA for signage, LTA for street lights, Town Councils for estates, NParks for parks, MCSTs for condos.

---

## 4. Tech stack

| Layer | Choice | Note |
|---|---|---|
| Framework | React + Vite, or plain HTML/JS | Whichever the team is genuinely faster in |
| Map | Leaflet | Free, simple, well-documented |
| Styling | Tailwind or hand-written CSS | Design is judged — budget real time here |
| Data | Static GeoJSON files in the repo | Download once, commit them. No live API dependency to break on demo day. |
| Storage | localStorage | No backend, no database |
| Hosting | Vercel or GitHub Pages | Free, gives us the required live URL |

**Deliberate choice: download the data and commit it.** A live API call that fails during judging is a catastrophe. Static files cannot fail.

---

## 5. Timeline — realistic, assumes classes

**Build finalises in 8 days — Wed 9 Sep.** Everything after is wrap-up, with a spare day at the end.

| Date | Day | Goal |
|---|---|---|
| **Wed 2 Sep** | 1 | Freeze the spec. Agree data contracts. Repo. **Deploy a hello-world today.** |
| **Thu 3 Sep** | 2 | Acquire the data — NParks GeoJSON, VIIRS, OneMap. Simplify geometry. Leaflet scaffold. |
| **Fri 4 Sep** | 3 | Map renders green space. Scoring function against mock inputs. |
| **Sat 5 Sep** | 4 | 🔨 Real scoring wired to real data. Risk surface rendering. |
| **Sun 6 Sep** | 5 | 🔨 Click → panel → score → recommendation, end to end. **Fieldwork after dark.** |
| **Mon 7 Sep** | 6 | Photo upload, EXIF, lamp classifier. Seed our survey data. |
| **Tue 8 Sep** | 7 | Collision reporting, search, layer toggles, methodology page. |
| **Wed 9 Sep** | 8 | **Finalise.** All hands on integration, mobile, bugs. Nothing new. |
| **Thu 10 Sep** | — | Design pass — every empty, loading and error state. Accessibility. |
| **Fri 11 Sep** | — | README, Devpost, final deploy, video script and rehearsal. |
| **Sat 12 Sep** | — | Record the 5-min video. **Submit.** |
| **Sun 13 Sep** | — | Buffer only — deadline day. |

**Gate at end of Sun 6 Sep:** if the map and score aren't working end to end, cut Layers 2 and 3 and ship the base map polished. That alone is a complete submission.

## 5a. Four lanes

Each lane owns its requirements outright — nobody waits on anybody after day one. **Agree the `scoreLocation(lat, lng)` contract on day one** so all four build in parallel against mock data. **Fifteen-minute standup every morning**, all four; that is how four independent lanes stay in sync.

| Lane | Owns | First task |
|---|---|---|
| **L1 · Data & Model** | Geodata, geometry simplification, scoring function, config | Download NParks boundaries, find out how big they are |
| **L2 · Map** | Leaflet, risk surface, click-select, search, layers | Leaflet rendering a Singapore basemap |
| **L3 · Result & Guidance** | Result panel, recommendations, seasonal context, methodology page | Build the panel against the mock `scoreLocation` contract |
| **L4 · Capture & Contribution** | EXIF, lamp classifier, collision reporting, share links | Throwaway page reading a photo's EXIF GPS and average colour — days 2–3, the only real technical unknown |

**There is no design lane — design is shared.** That only works if the constraints exist first:

- **Day 1, before any feature work:** two people spend 2–3 hours building the token set (colours incl. semantic low/moderate/high, four type sizes, spacing scale, one radius) and five shared components — `Button`, `Panel`, `Card`, `RiskPill`, `EmptyState`.
- **One rule after that:** no component defines its own colour. Need a hue that isn't a token? Add a token, agreed by the team.
- **Checkpoints, all four people:** Day 1 tokens · Sun 6 a 30-minute review with the app open on a real phone · Wed 9 group pass on empty/loading/error states · Thu 10 full design day.

**Admin needs named owners, not a lane** — put a name and a date against each or it won't happen:

| Task | When | Owner |
|---|---|---|
| Deploy pipeline | Day 1, ~1 hour then automatic | _______ |
| NSS email | Today | _______ |
| README | Day 8–10, each lane writes its section | all |
| Devpost draft | Fri 11 | _______ |
| Video script + edit | Fri 11 – Sat 12 | _______ |

---

## 6. The five-minute video

| Time | Content |
|---|---|
| 0:00–0:45 | **Problem.** Most light-polluted country on Earth, sitting under a major flyway. Birds die every October. |
| 0:45–1:15 | **Insight.** It's not brightness — it's blue light. And it's the forest edges, not the city core. |
| 1:15–3:15 | **Demo.** The map, a location lookup, the recommendation, the lamp check. |
| 3:15–4:15 | **How it works.** Three data sources, the risk score, why we cite published research. |
| 4:15–5:00 | **Impact and limits.** What it would change, and what we don't know yet. |

Script it. Rehearse against a timer. Over five minutes risks disqualification.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| VIIRS data format is unfamiliar | Fall back to a simplified light layer, or hand-classify a few zones. Don't lose a day to a GeoTIFF. |
| OneMap search integration stalls | Ship with map-click selection instead of address search. |
| Over-scoping late in the week | Feature freeze 9 Sep is absolute. |
| Video runs long | Script and time it on the 11th, not the 12th. |
| Nothing deployed until the end | Deploy on day 1 and redeploy daily. |

---

## 8. Honest framing for the Devpost

State these plainly — judges find them anyway, and saying them first reads as rigour:

- The collision drivers come from a **published Conservation Biology study (2024)**, not from us. We operationalise it.
- Our risk score is a **weighted heuristic**, not a validated model.
- Collision reporting is a demonstration; we have not collected real data at scale.
- The repo was **empty before 21 Aug** — everything was built during the hackathon. Say so; the rules require it and it helps us.

---

## 9. Do today

1. Agree this scope.
2. Confirm the submission deadline **time and timezone** on Discord.
3. Create the repo, scaffold, **deploy a hello-world**.
4. Email the Nature Society (Singapore) Bird Group and the Conservation Biology corresponding author. One reply is a real collaboration credit.
