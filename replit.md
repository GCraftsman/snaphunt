# SnapHunt - Team Photo Scavenger Hunt

## Overview

SnapHunt is a real-time multiplayer photo and video scavenger hunt game. A proctor creates a hunt with configurable teams, items, and duration. Players join via a 6-character game code, pick teams in a lobby, then compete to photograph or record video of scavenger hunt items. Photos are verified using OpenAI's vision API or manually by the proctor (configurable per item). Video submissions are always proctor-reviewed. The game uses WebSockets for real-time state synchronization across all connected clients.

**Core flow:** Proctor creates hunt → Players join via code → Teams are formed in lobby → Countdown → Active game with photo/video submissions → AI or proctor verification → Scoring → Game over with leaderboard.

**Verification modes:** Each scavenger item can be set to "AI" (default, uses OpenAI vision) or "Proctor" (manual review). Proctor-verified items create pending submissions that appear in the proctor's review queue. The proctor can approve (awards points) or reject (with feedback shown to the player). Video items are always proctor-reviewed.

**Video submissions:** Items can be set to "photo" or "video" media type during hunt setup. Video items have configurable recording length (10-60 seconds, default 20s, in 10s intervals). Players record using MediaRecorder API with real-time countdown timer and progress bar; recording auto-stops at the time limit. Videos are recorded at lower quality (500kbps, 640x480) for faster upload. After recording and confirming, players are returned to the list immediately while the video uploads in the background. An "uploading" status is shown on the item until complete. Videos are stored as base64 data URIs and stream to the proctor during review.

**Location tracking:** Optional feature toggled during hunt setup. When enabled, player devices send GPS pings every 30 seconds via WebSocket during active gameplay. The proctor sees a live Leaflet map with team-colored player markers during the game. After the game ends, a replay view shows animated player trails with a timeline scrubber (play/pause/speed controls). Submissions with lat/lng are shown as star markers on the map. Data stored in `location_pings` table; submissions can optionally include lat/lng coordinates.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework:** React with TypeScript, bundled by Vite
- **Routing:** Wouter (lightweight client-side router) with 5 main pages: Home, ProctorDashboard, HuntResults, Lobby, Game
- **State Management:** React Context (`GameContext`) manages all game state including WebSocket connection, player info, teams, items, submissions, and countdown timers. Session persistence uses `sessionStorage`.
- **UI Components:** shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS v4. Dark arcade-themed design with vibrant neon colors (hot pink primary, cyan secondary, purple accent).
- **Data Fetching:** TanStack React Query for API calls, with a custom `apiRequest` helper
- **Animation:** Framer Motion for transitions, react-confetti for celebrations
- **Camera:** react-webcam for in-browser photo capture
- **PWA:** Installable as a Progressive Web App on iOS and Android. Manifest at `client/public/manifest.json`, service worker at `client/public/sw.js`, with cache-first-with-network-fallback strategy. iOS meta tags for standalone mode included in `index.html`.
- **Styling:** Tailwind CSS with CSS variables for theming, custom fonts (Chakra Petch display, Inter body) loaded from Google Fonts

### Backend (server/)
- **Framework:** Express 5 on Node.js with TypeScript (tsx runner)
- **Real-time:** WebSocket server (ws library) attached to the HTTP server. Maintains per-hunt connection sets for broadcasting state updates to all players in a hunt.
- **API Pattern:** RESTful JSON API under `/api/` prefix. Key endpoints handle hunt creation, player joining, team management, photo submissions, and AI verification.
- **AI Integration:** OpenAI API (via Replit AI Integrations proxy) for photo verification - determines if submitted photos match scavenger item descriptions
- **Static Serving:** In production, serves built Vite output from `dist/public/`. In development, Vite dev server runs as middleware with HMR.

### Authentication
- **Replit Auth** via OpenID Connect for proctor accounts. Players join without accounts.
- **Session storage:** PostgreSQL-backed sessions via `connect-pg-simple` (sessions table)
- **Auth flow:** `/api/login` → Replit OIDC → `/api/callback` → session created
- **Protected routes:** `POST /api/hunts` (create), `GET /api/my/hunts` (history), `POST /api/hunts/:id/stop` (stop game)
- **Client hook:** `useAuth()` in `client/src/hooks/use-auth.ts` provides user state, login/logout

### Database
- **Database:** PostgreSQL with Drizzle ORM
- **Schema** (in `shared/schema.ts`):
  - `hunts` - Game sessions with code, name, status, proctorUserId, duration, team settings, timestamps (gameStartTime, gameEndTime)
  - `teams` - Teams belonging to a hunt with name, color, score
  - `players` - Players with hunt/team associations, userId (optional), proctor flag, session token
  - `scavenger_items` - Hunt items with description, points, sort order
  - `submissions` - Photo submissions linking player, team, item with photo data (base64) and AI verification result
  - `sessions` - Auth session storage (required by Replit Auth)
  - `users` - User accounts from Replit Auth
- **Migrations:** Drizzle Kit with `db:push` command for schema sync. Note: drizzle-kit push prompts for interactive input; for new tables, use SQL directly via execute_sql_tool.
- **Storage layer:** `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class wrapping all Drizzle queries

### Shared Code (shared/)
- `shared/schema.ts` contains Drizzle table definitions and Zod schemas (via drizzle-zod) used by both client and server. Re-exports from `shared/models/auth.ts` and `shared/models/chat.ts`.
- `shared/models/auth.ts` - User and session table definitions for Replit Auth
- `shared/models/chat.ts` - Conversation/message schemas for the Replit AI chat integration (secondary feature)

### Build System
- **Development:** `tsx server/index.ts` runs the server which sets up Vite middleware for the client
- **Production build:** Custom `script/build.ts` runs Vite build for client, then esbuild for server (bundling key deps to reduce cold start syscalls). Output goes to `dist/`.
- **Path aliases:** `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Replit Integrations (server/replit_integrations/)
Pre-built modules for AI features:
- **chat/** - Conversation storage and chat API routes using OpenAI
- **audio/** - Voice recording, playback, and speech-to-text/text-to-speech
- **image/** - Image generation using gpt-image-1
- **batch/** - Batch processing with rate limiting and retries

## External Dependencies

### Required Services
- **PostgreSQL** - Primary database, connected via `DATABASE_URL` environment variable
- **OpenAI API** (via Replit AI Integrations) - Used for photo verification in submissions. Configured via `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables.

### Key npm Packages
- **Server:** express v5, ws (WebSockets), drizzle-orm, pg, openai, zod
- **Client:** react, wouter, @tanstack/react-query, framer-motion, react-webcam, qrcode.react, react-confetti, shadcn/ui components (Radix UI primitives)
- **Build:** vite, esbuild, tsx, tailwindcss