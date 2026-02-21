# Session Log — Orbit Development

> This file tracks development sessions, decisions, actions, and timestamps.
> Append new entries at the top. Each session gets a header with date/time.

---

## Session 1 — 2026-02-21 12:45 EST (Pre-Hackathon Prep)

### Context
- Hackathon: AI Tinkerers "Generative Interfaces × Claude" (NYC, Feb 22, 2026)
- Goal: Build working prototype of Orbit — semantic canvas with generative UI cards

### Decisions Made
| Decision | Rationale |
|----------|-----------|
| No multiplayer | Too complex for 12h; doesn't score extra on judging criteria |
| No CopilotKit | Direct Claude API gives more control over card generation |
| No real URL scraping | Time sink; Claude can infer card type from URL text alone |
| @xyflow/react over React Flow | Same library, new package name. Stable canvas primitives |
| Redis VSS only | The wow factor for judges; skip Pub/Sub and RedisJSON |
| Plain JS, no TypeScript | Hackathon pace — move fast |
| FastAPI backend | Lightweight, async, fast to prototype |

### Actions Taken
- [ ] Created project structure
- [ ] Created CLAUDE.md
- [ ] Created SESSION_LOG.md (this file)
- [ ] Created FAILURE_MODES.md
- [ ] Set up backend (FastAPI + Redis + Claude)
- [ ] Set up frontend (Next.js + canvas)
- [ ] Core loop working end-to-end
- [ ] Magnet tool working
- [ ] Visual polish complete

### Blockers / Issues
_None yet_

### Notes
- Anthropic credits should be available at hackathon check-in
- Need Redis Cloud free tier instance OR local Redis Stack via Docker
- Demo scenario: apartment hunting with friends
