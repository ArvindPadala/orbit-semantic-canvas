# CLAUDE.md — Persistent Agent Context for Orbit

> This file is injected at session start for any AI agent working on this codebase.
> It serves as the system prompt for agentic work on this project.

## Project Identity

**Orbit** is a semantic spatial canvas — a hackathon project for the AI Tinkerers "Generative Interfaces × Claude" hackathon (Feb 2026, NYC).

Users drop content (URLs, notes, raw text) onto a 2D canvas. Claude generates interactive UI cards with dynamic widgets. Redis Vector Search provides "semantic gravity" — cards automatically drift toward semantically similar cards. A "Magnet" tool lets users drag a filter widget and type constraints to physically pull matching cards.

## Architecture Overview

```
Frontend (Next.js 14, App Router)
├── @xyflow/react          → 2D draggable canvas
├── framer-motion           → Gravity/spring animations
├── Components: Canvas, OrbitCard, Magnet, InputBar, Toolbar
└── Hooks: useGravity (physics simulation)

Backend (FastAPI, Python 3.11+)
├── Claude API (Anthropic)  → Generative card schemas (structured JSON)
├── Redis Stack (VSS)       → Vector embeddings + similarity search
├── Endpoints: /generate-card, /embed, /gravity, /magnet
└── Models: Pydantic schemas
```

## Conventions & Patterns

### Frontend
- **React components**: Functional components with hooks, `.jsx` extension
- **Naming**: PascalCase for components (`OrbitCard.jsx`), camelCase for hooks (`useGravity.js`), camelCase for lib utils (`api.js`)
- **State**: React state + @xyflow/react's built-in node/edge state. No Redux, no external state libraries
- **Styling**: CSS Modules or globals via `globals.css`. Dark theme. Glassmorphism aesthetic
- **API calls**: All go through `src/lib/api.js` — never call fetch directly in components

### Backend
- **Framework**: FastAPI with async endpoints
- **Services pattern**: Business logic in `services/` (claude_service, redis_service, embedding_service). Endpoints are thin wrappers
- **Models**: All request/response types defined in `models/schemas.py` with Pydantic
- **Environment**: All secrets in `.env`, loaded via `python-dotenv`. Never hardcode API keys
- **CORS**: Allow `http://localhost:3000` in development

### Claude Integration
- **Model**: Use `claude-sonnet-4-20250514` for card generation (best balance of speed + quality)
- **Output format**: Always request structured JSON output via system prompt
- **System prompt**: Define card schema in the system prompt. User message is the raw dropped content
- **Streaming**: Not needed for card generation (responses are small JSON blobs)

### Redis
- **Index name**: `orbit_cards_idx`
- **Vector field**: `embedding` (FLOAT32 vector, dimensions depend on embedding approach)
- **Distance metric**: Cosine similarity
- **Key pattern**: `card:{card_id}` for card data, vector stored inline

## Guardrails

### DO NOT
- ❌ Add multiplayer/real-time sync (Pub/Sub) — out of scope for MVP
- ❌ Use CopilotKit — direct Claude API calls give us more control
- ❌ Actually scrape URLs (Zillow, Yelp, etc.) — Claude infers card type from the URL/text
- ❌ Add authentication or user accounts
- ❌ Use Redux, Zustand, or external state management
- ❌ Add SSR/ISR complexity — this is a client-heavy SPA
- ❌ Over-engineer error handling — graceful degradation is fine for a hackathon
- ❌ Use TypeScript — plain JS to move fast (hackathon pace)

### DO
- ✅ Keep it visually stunning — dark theme, glassmorphism, smooth animations
- ✅ Make the demo flow work end-to-end (drop → card → gravity → magnet)
- ✅ Use Claude's reasoning to DRIVE the UI (not just generate text)
- ✅ Keep the backend stateless (Redis holds all persistent state)
- ✅ Focus on the "apartment hunting" demo scenario for the presentation

## File Structure

```
Claude1/
├── CLAUDE.md                  # This file
├── SESSION_LOG.md             # Development session log
├── FAILURE_MODES.md           # Agent failure documentation
├── .env.example               # Environment template
├── .gitignore
├── frontend/                  # Next.js 14 app
│   ├── package.json
│   ├── next.config.mjs
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.js
│   │   │   ├── page.js
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── Canvas.jsx
│   │   │   ├── OrbitCard.jsx
│   │   │   ├── Magnet.jsx
│   │   │   ├── InputBar.jsx
│   │   │   └── Toolbar.jsx
│   │   ├── hooks/
│   │   │   └── useGravity.js
│   │   └── lib/
│   │       └── api.js
│   └── public/
└── backend/                   # FastAPI server
    ├── requirements.txt
    ├── main.py
    ├── services/
    │   ├── claude_service.py
    │   ├── redis_service.py
    │   └── embedding_service.py
    └── models/
        └── schemas.py
```

## Demo Scenario (Apartment Hunting)

For the hackathon demo, walk through this flow:
1. Drop "Quiet 2BR apartment near Central Park, budget $3000/mo" → generates apartment card with Budget slider, Noise Level indicator
2. Drop "https://zillow.com/homedetails/456-west-72nd" → generates apartment card with Price, Bedrooms, Natural Light widgets
3. Drop "Best coffee shops Upper West Side" → generates restaurant/cafe card with Vibe Meter, Rating stars
4. Watch cards cluster: apartment cards drift together, cafe card stays separate
5. Drop a Magnet, type "near park" → apartment cards pull toward magnet, cafe fades
6. Drop another cafe link → it drifts toward the first cafe card

## Session Recovery

If resuming work mid-session:
1. Check `SESSION_LOG.md` for last known state
2. Run `cd frontend && npm run dev` to start frontend (port 3000)
3. Run `cd backend && uvicorn main:app --reload` to start backend (port 8000)
4. Check Redis connection: backend health endpoint at `GET /health`
