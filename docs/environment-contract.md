# Environment contract

## Purpose

Define the minimum independent runtime contract for Bruno Advisory T0.

## Rules

- No VLH environment variables are valid here.
- No shared secrets, shared DB URLs, shared storage paths, or shared deploy variables.
- `.env.example` is the canonical variable list for local T0.
- `.env` is local-only and must not be committed.

## Minimum variables

- `NODE_ENV`: runtime mode
- `PORT`: local app port
- `APP_BASE_URL`: local base URL for checks and callbacks
- `CONTROL_ROOM_ENABLED`: toggles the internal control surface
- `DATABASE_PROVIDER`: current T0 dev provider, `sqlite`
- `DATABASE_URL`: current T0 dev DB path
- `BACKUP_ARCHIVE`: default local backup artifact path

## Current T0 baseline

- local app runtime only
- local standalone deploy proof
- local SQLite dev DB path
- no production secrets committed
- no VLH variable inheritance
