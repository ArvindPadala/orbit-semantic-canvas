# Failure Modes — Agent & System Documentation

> Documents known failure patterns for AI agents working on this codebase,
> and runtime failure modes of the Orbit application itself.

---

## Agent Failure Modes

### 1. Context Window Overflow
- **Symptom**: Agent loses track of file structure, re-creates files that exist, or produces inconsistent code
- **Trigger**: Too many large files viewed in a single session
- **Mitigation**: Use `CLAUDE.md` as the single source of truth for architecture. Agent should read CLAUDE.md at session start, not re-explore the entire codebase
- **Recovery**: Re-read CLAUDE.md, check SESSION_LOG.md for last known state

### 2. Phantom Dependencies
- **Symptom**: Agent imports packages that were never installed, or uses APIs from wrong library versions
- **Trigger**: Hallucinating package names or confusing similar libraries
- **Mitigation**: Always check `package.json` (frontend) and `requirements.txt` (backend) before importing. Pin versions explicitly
- **Known risks**: `@xyflow/react` vs old `react-flow-renderer` namespace, `framer-motion` API changes between v10/v11

### 3. Schema Drift
- **Symptom**: Frontend expects a different card JSON shape than backend produces
- **Trigger**: Agent modifies backend card generation without updating frontend card renderer, or vice versa
- **Mitigation**: `backend/models/schemas.py` is the single source of truth for card shapes. Any schema change must update both `claude_service.py` (backend) and `OrbitCard.jsx` (frontend)
- **Detection**: Cards render as blank or crash with "cannot read property of undefined"

### 4. Redis Connection Failures
- **Symptom**: Backend crashes on startup or gravity endpoint returns 500
- **Trigger**: Redis not running, wrong connection URL, or index doesn't exist
- **Mitigation**: Backend should gracefully handle Redis being down — return empty similarity matrix, don't crash. Health endpoint should report Redis status
- **Recovery**: Check `.env` for `REDIS_URL`, ensure Redis Stack is running with vector search module

### 5. Claude API Rate Limits / Timeouts
- **Symptom**: Card generation hangs or returns error
- **Trigger**: Too many rapid-fire card generation requests
- **Mitigation**: Add a simple queue/debounce on the frontend — don't fire a new request while one is pending. Show loading state on the card placeholder
- **Recovery**: Retry with exponential backoff (built into Anthropic SDK)

### 6. Gravity Simulation Instability
- **Symptom**: Cards fly off screen, jitter endlessly, or collapse to a single point
- **Trigger**: Physics constants too aggressive, or similarity scores all identical
- **Mitigation**: Clamp velocity, add damping factor, set minimum separation distance. Test with 3-5 cards before scaling up
- **Known constants**: `GRAVITY_STRENGTH = 0.5`, `DAMPING = 0.9`, `MIN_DISTANCE = 150`

### 7. Embedding Dimension Mismatch
- **Symptom**: Redis rejects vector storage or similarity search fails
- **Trigger**: Embedding service returns vectors of different dimensions than the Redis index expects
- **Mitigation**: Fix embedding dimensions in one place (embedding_service.py) and match in Redis index creation. Current plan: 256-dimensional vectors
- **Detection**: Redis error "vector dimension mismatch"

---

## Runtime Failure Modes

### Frontend
| Failure | Cause | User Impact | Fix |
|---------|-------|-------------|-----|
| Canvas blank | @xyflow/react not initialized | No canvas visible | Check ReactFlowProvider wrapping |
| Cards don't render | Schema mismatch | Empty card shells | Compare backend JSON vs OrbitCard.jsx expected props |
| No gravity motion | useGravity hook not running | Static cards | Check if similarity matrix is being fetched |
| Magnet does nothing | Backend /magnet endpoint error | No visual response | Check console for 500 errors |

### Backend
| Failure | Cause | User Impact | Fix |
|---------|-------|-------------|-----|
| 500 on /generate-card | Claude API key invalid | Card generation fails | Check ANTHROPIC_API_KEY in .env |
| 500 on /gravity | Redis not connected | No gravity data | Check REDIS_URL, ensure Redis Stack running |
| 422 on any endpoint | Pydantic validation error | Request rejected | Check request payload matches schema |
| Slow /generate-card | Claude cold start or large prompt | 3-5s delay | Show loading skeleton on frontend |

---

## Pre-Demo Checklist

Before the demo, verify:
- [ ] Backend health endpoint returns `{"status": "ok", "redis": "connected", "claude": "ok"}`
- [ ] Can generate a card from text input
- [ ] Can generate a card from a URL-like string
- [ ] 3+ cards show gravity clustering
- [ ] Magnet tool filters cards visually
- [ ] No console errors in browser
- [ ] Animations are smooth (60fps)
- [ ] Dark theme looks polished on projector (test on external display)
