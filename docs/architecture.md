# T0 Architecture

- Single local web app in `apps/web`
- Next.js + TypeScript, manually scaffolded
- Control Room reads canonical repo state from `project.yaml` and `risk-log.md`
- Health exposed at `/health` and `/api/health`
- No VLH runtime, code, secrets, database, or deploy coupling
