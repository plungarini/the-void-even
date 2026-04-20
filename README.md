# The Void

A memento mori counter for Even Realities G2 glasses. Since you last tapped,
the world has lost `N` souls. Tap to reset. Watch the void fill again.

## How it works

- **Rate source.** On startup the app fetches the World Bank's crude death
  rate (`SP.DYN.CDRT.IN`) and world population (`SP.POP.TOTL`) indicators
  and computes deaths-per-second. Cached in memory for 24h. Falls back to a
  hardcoded 2024 figure (`2.04`/sec) on failure.
- **State.** Two values — a `tapTimestamp` (reset moment) and the resolved
  `deathsPerSec` rate. Deaths are computed on the fly as
  `(now - tap) * deathsPerSec`.
- **HUD.** One full-screen text container on the glasses. Single click
  resets the counter. Double-click exits the app (root-page submission rule).
- **Web UI.** A dark minimal React page mirrors the counter and exposes a
  tap button that writes to the same shared store.

## Architecture

Same split as `smokeless`: a React web UI layer and a pure-TypeScript
glasses layer talk to the Even Realities SDK directly, sharing state
through a single in-memory store. No `even-toolkit` on the HUD side.

```
src/
  app/store.ts            — shared state (tap timestamp + deaths/sec)
  services/death-rate.ts  — World Bank fetch with 24h cache + fallback
  glasses/
    session.ts            — SDK wrapper (createStartUpPage/rebuild/upgrade)
    render-loop.ts        — debounced render scheduler
    events.ts             — bridge event dispatcher
    tick.ts               — 1-second render pulse
    void-view.ts          — the single HUD screen
    constants.ts, types.ts
  glasses-main.ts         — pure-TS entry (bridge init, wire everything)
  main.tsx, App.tsx       — React entry + UI
```

## Scripts

```bash
npm run dev       # vite dev server on :5173
npm run build     # type-check + vite build
npm run pack      # build + package as the-void.ehpk
npm run qr        # print a QR code for sideloading
npm run emulator  # launch the Even Hub simulator
```
