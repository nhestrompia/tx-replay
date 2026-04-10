# Hyperliquid Position Replayer

Open-source wallet-to-replay engine for Hyperliquid positions.

## Stack

- Frontend: Next.js, React Query, Tailwind, shadcn-style UI, Liveline
- Backend: Rust (Axum), deterministic position reconstruction
- Storage: SQLite cache for fills/day-sync state
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

### Error Format

All non-2xx API responses return:

```json
{
  "error": {
    "code": "invalid_wallet",
    "message": "wallet must be a valid 0x-prefixed 40-byte hex address"
  }
}
```

## Notes

- Date range is first-class and required for fast wallet lookup on large histories.
- Position reconstruction is deterministic and based on fill sequence.
- Hyperliquid API limits/history windows still apply.
- Frontend fetch layer uses React Query globally for caching and deduping.
- UI is split into small modular files (one component per file).
- If a query range starts mid-position, boundary close-only fills are ignored to avoid phantom positions.
- Backend ingestion is overflow-safe: capped windows are split recursively and then cursor-paginated.
- Replays include play/pause, speed, scrubber, and step forward/back controls.
- Funding is shown as a timeline chart aligned to replay cursor.
