# AudioTalents Server

Phase 1 backend foundation for AudioTalents. The server uses Node.js, Express, CommonJS, dotenv, CORS, bcryptjs, JWT, and an in-memory repository layer.

## Run locally

```bash
npm install
npm run dev
```

The API runs at `http://localhost:5000` by default.

## Environment

Copy `.env.example` to `.env` and configure `PORT`, `CLIENT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `JWT_REFRESH_EXPIRES_IN`.

## Architecture

```text
routes -> middleware -> controllers -> services -> repositories -> database adapter later
```

Repositories currently use in-memory storage so the health check and Phase 1 business rules work without MongoDB. They are intentionally isolated behind repository classes for a future MongoDB implementation.

## Main endpoints

- `GET /api/health`
- `/api/auth`
- `/api/users`
- `/api/creators`
- `/api/stories`
- `/api/stories/:storyId/chapters`
- `/api/chapters/:id`
- `/api/genres`
- `/api/audio`
- `/api/library`
- `/api/playlists`
- `/api/stories/:id/comments`
- `/api/stories/:id/rating`
- `/api/search`

Deferred modules expose architecture placeholders until their Phase 2 API and persistence work is implemented.
