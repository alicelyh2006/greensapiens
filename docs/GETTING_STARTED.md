# Getting started

## Prerequisite: Node.js

Not currently installed on at least one team machine. Get the **LTS** build from
<https://nodejs.org>, then restart your terminal and check:

```bash
node --version
npm --version
```

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. You should see a map of Singapore; clicking anywhere
drops a pin and shows a placeholder risk panel fed by mock data.

```bash
npm run build     # production build into dist/
npm run preview   # serve that build locally
```

## Layout

```
src/
├─ lib/                    L1 · Data & Model
│  ├─ config.js            all weights and thresholds — N8, no magic numbers
│  ├─ score.js             F5 scoreLocation() — MOCK, L1 replaces the internals
│  └─ recommendations.js   F6 — stub
├─ features/
│  ├─ map/MapView.jsx      L2 · F1 F2 F3 F4 F12
│  ├─ result/
│  │  ├─ ResultPanel.jsx   L3 · F5 F6 F7
│  │  └─ Methodology.jsx   L3 · F8
│  └─ capture/
│     ├─ LampUpload.jsx    L4 · F9 F10
│     └─ ReportForm.jsx    L4 · F11
├─ components/index.jsx    Button · Panel · Card · RiskPill · EmptyState
├─ styles/tokens.css       the shared design constraint
└─ App.jsx                 shell — composition only, no feature logic

public/data/               static geodata (see its README before committing)
```

Every stub carries `TODO(lane · requirement)` comments pointing at the
requirement it implements.

## The contract that lets four people work at once

`scoreLocation(lat, lng)` returns this shape. **Do not change it without telling
the team** — three lanes depend on it:

```js
{
  total: 0-100,
  band: 'low' | 'moderate' | 'high',
  factors: {
    habitat: { value, weight, note },
    light:   { value, weight, note },
    density: { value, weight, note },
  },
  isMock: true   // delete once L1 lands the real model
}
```

It currently returns plausible fake values, so L2, L3 and L4 can all build
immediately without waiting for L1.

## House rules

- **No component defines its own colour.** Everything from `styles/tokens.css`.
  Need a hue that isn't a token? Add a token and tell the team.
- **No magic numbers.** Weights and thresholds go in `lib/config.js`.
- **Risk is never colour alone** (N4). `RiskPill` always carries a text label.
- **Nothing leaves the device** (N5). localStorage only, wrapped in try/catch.
- **Commit simplified geodata, never raw downloads.** `data-raw/` is gitignored.

## Deploying

Vercel or GitHub Pages, both free. Set it up on day one and redeploy on every
push — the live URL is a submission requirement and you do not want to be
discovering deployment problems on the 12th.

For GitHub Pages served at `/greensapiens/`, set `base: '/greensapiens/'` in
`vite.config.js`. Vercel serves from the root, so leave it as `'/'`.
