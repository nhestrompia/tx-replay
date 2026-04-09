# Hyperliquid Position Replayer

Open-source wallet-to-replay engine for Hyperliquid positions.

## Stack

- Frontend: Next.js, React Query, Tailwind, shadcn-style UI, Liveline
- Backend: Rust (Axum), deterministic position reconstruction
- License: MIT
- Open-source: no paid dependencies required

## Monorepo Layout

- `apps/web` - Next.js frontend
- `apps/api` - Rust API backend

## Quick Start (Docker)

```bash
docker compose up --build
```

Web: [http://localhost:3000](http://localhost:3000)
API health: [http://localhost:8080/health](http://localhost:8080/health)

## Local Dev

### API

```bash
cd apps/api
cargo run
```

### Web

```bash
cd apps/web
npm install
npm run dev
```

## API Endpoints

- `GET /health`
- `GET /v1/positions?wallet=0x...&from=...&to=...&pair=BTC&direction=long&page=1&page_size=25`
- `GET /v1/replay/:position_id?wallet=0x...&from=...&to=...&pre_ms=14400000&post_ms=3600000&interval=5m`

## Notes

- Date range is first-class and required for fast wallet lookup on large histories.
- Position reconstruction is deterministic and based on fill sequence.
- Hyperliquid API limits/history windows still apply.
- Frontend fetch layer uses React Query globally for caching and deduping.
- UI is split into small modular files (one component per file).
- If a query range starts mid-position, boundary close-only fills are ignored to avoid phantom positions.
