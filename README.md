# Orbit ✦ Semantic Canvas

**A spatial canvas where you drop content, Claude generates interactive cards, and Redis Vector Search provides "semantic gravity" to auto-organize everything by meaning.**

Built for the AI Tinkerers "Generative Interfaces × Claude" Hackathon (NYC, Feb 2026).

![Demo](https://img.shields.io/badge/Status-Hackathon%20Prototype-purple)

## 🎯 What is Orbit?

Orbit reimagines how people organize information collaboratively. Instead of rigid spreadsheets or chaotic group chats, Orbit gives you a **spatial canvas** where:

1. **Drop anything** — paste a URL, type a note, describe something
2. **Claude generates interactive cards** — each piece of content becomes a rich card with sliders, star ratings, tags, and more
3. **Semantic gravity** — Redis Vector Search computes meaning similarity between cards, and they **physically drift toward similar content**
4. **Magnet tool** — drag a magnet widget, type a constraint like "near the park," and matching cards are pulled toward it

## 🏗 Architecture

```
User → InputBar → FastAPI Backend → Claude (card generation)
                                  → Redis VSS (embeddings + gravity)
                    ↓
         @xyflow/react Canvas → framer-motion (gravity animations)
```

| Layer | Tech |
|-------|------|
| Canvas | @xyflow/react + framer-motion |
| Frontend | Next.js 14 (App Router) |
| Backend | FastAPI (Python) |
| AI | Claude 3.5 Sonnet (Anthropic) |
| Vector DB | Redis Stack (Vector Search) |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Redis Stack (with Vector Search module)
- Anthropic API key

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and REDIS_URL
```

### 2. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open
Navigate to [http://localhost:3000](http://localhost:3000)

## 🎮 How to Use

1. **Type or paste** content in the bottom input bar
2. **Watch Claude** generate an interactive card
3. **Drop 3+ items** and watch them cluster by meaning
4. **Click 🧲** to add a magnet filter
5. **Type a constraint** in the magnet and press Enter
6. **Drag cards** freely — they'll re-attract on "Re-orbit"

## 🏆 Judging Score Strategy

| Criteria | Approach |
|----------|----------|
| **Interface Novelty** | Semantic gravity, magnet tool — no chat windows |
| **Theme Alignment** | Claude drives the UI (what widgets to show), not just content |
| **Working Prototype** | Full loop: input → card → gravity → magnet |
| **Claude Integration** | Claude decides card structure + evaluates magnet relevance |

## 📁 Project Structure

```
├── CLAUDE.md           # Agent context file
├── README.md           # This file
├── frontend/           # Next.js 14
│   ├── components/     # Canvas, OrbitCard, Magnet, InputBar, Toolbar
│   ├── hooks/          # useGravity (physics simulation)
│   └── lib/            # API client
└── backend/            # FastAPI
    ├── services/       # claude_service, redis_service, embedding_service
    └── models/         # Pydantic schemas
```

## License

MIT — Built with ☕ for the AI Tinkerers hackathon.
