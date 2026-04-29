# The Void

> **Watch absence accumulate.**

A memento-mori counter for the Even Realities Glasses glasses. Every second, people around the world pass away. Tap to reset the counter and witness the void fill again — a quiet, ever-present reminder of life's fragility.

## What it does

The Void fetches the latest global crude death rate and world population from the World Bank open-data API, computes a live deaths-per-second figure, and displays the running total on your G2 glasses. A single tap resets the counter; a double-tap exits the app. A dark, minimal companion web page mirrors the data for easy setup and reflection.

## Key Features

- **Live global death counter** — updates every second based on real World Bank statistics (cached 24 h; falls back gracefully to a hardcoded 2024 rate).
- **One-tap reset** — tap anywhere on the glasses to start the count anew.
- **Persistent state** — your last tap timestamp survives app restarts via bridge local storage.
- **High-fidelity HUD** — pixel-accurate layout using `@evenrealities/pretext` and canvas-rendered image containers for jitter-free numbers.
- **Dual-layer architecture** — React web UI and a pure-TypeScript glasses layer share a single in-memory store; the HUD talks directly to the Even SDK.

## How it works / User flow

1. **Launch** — the app boots, restores any saved tap timestamp from bridge storage, and fetches the latest death rate in the background.
2. **Display** — the glasses show a header with the current time, a large running death count, and an elapsed timer since your last tap.
3. **Interact** — tap once to reset the counter to zero; double-tap to close the app.
4. **Web UI** — the phone page shows the same counter and a manual reset button, plus a temporary debug panel during development.

## Tech Stack

| Layer           | Tech                                                             |
| --------------- | ---------------------------------------------------------------- |
| Language        | TypeScript                                                       |
| Build tool      | Vite (with custom full-reload plugin for HUD safety)             |
| Web UI          | React 19                                                         |
| SDK             | `@evenrealities/even_hub_sdk`                                    |
| CLI / Simulator | `@evenrealities/evenhub-cli`, `@evenrealities/evenhub-simulator` |
| Text metrics    | `@evenrealities/pretext`                                         |

## Getting Started

```bash
npm install
npm run dev       # start Vite dev server on :5173
npm run qr        # print a QR code for sideloading onto your phone
npm run pack      # build and package as the-void.ehpk
npm run emulator  # launch the Even Hub simulator
```

## Why it exists

The G2 glasses are a glanceable display — perfect for ambient, low-friction information. The Void turns that glance into a philosophical nudge: a constant, gentle memento mori that needs no unlock, no scroll, and no distraction. It solves the problem of "out of sight, out of mind" by making mortality quietly visible, one second at a time.
