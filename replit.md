# SnapHunt - Team Photo Scavenger Hunt

## Overview

SnapHunt is a real-time multiplayer photo scavenger hunt game. A proctor creates a hunt with configurable teams, items, and duration. Players join via a 6-character game code, pick teams in a lobby, then compete to photograph scavenger hunt items. Photos are verified using OpenAI's vision API. The game uses WebSockets for real-time state synchronization across all connected clients.

**Core flow:** Proctor creates hunt → Players join via code → Teams are formed in lobby → Countdown → Active game with photo submissions → AI verification → Scoring → Game over with leaderboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework:** React with TypeScript, bundled by Vite
- **Routing:** Wouter (lightweight client-side router) with 4 main pages: Home, ProctorDashboard, Lobby, Game
- **State Management:** React Context (`GameContext`) manages all game state including WebSocket connection, player info, teams, items, submissions, and countdown timers. Session persistence uses `sessionStorage`.
- **UI Components:** shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS v4. Dark arcade-themed design with vibrant neon colors (hot pink primary, cyan secondary, purple accent).
- **Data Fetching:** TanStack React Query for API calls, with a custom `apiRequest` helper
- **Animation:** Framer Motion for transitions, react-confetti for celebrations
- **Camera:** react-webcam for in-browser photo capture
- **Styling:** Tailwind CSS with CSS variables for theming, custom fonts (Chakra Petch display, Inter body) loaded from Google Fonts

### Backend (server/)
- **Framework:** Express 5 on Node.js with TypeScript (tsx runner)
- **Real-time:** WebSocket server (ws library) attached to the HTTP server. Maintains per-hunt connection sets for broadcasting state updates to all players in a hunt.
- **API Pattern:** RESTful JSON API under `/api/` prefix. Key endpoints handle hunt creation, player joining, team management, photo submissions, and AI verification.
- **AI Integration:** OpenAI API (via Replit AI Integrations proxy) for photo verification - determines if submitted photos match scavenger item descriptions
- **Static Serving:** In production, serves built Vite output from `dist/public/`. In development, Vite dev server runs as middleware with HMR.

### Database
- **Database:** PostgreSQL with Drizzle ORM
- **Schema** (in `shared/schema.ts`):
  - `hunts` - Game sessions with code, status, duration, team settings, timestamps
  - `teams` - Teams belonging to a hunt with name, color, score
  - `players` - Players with hunt/team associations, proctor flag, session token
  - `scavenger_items` - Hunt items with description, points, sort order
  - `submissions` - Photo submissions linking player, team, item with photo data (base64) and AI verification result
- **Migrations:** Drizzle Kit with `db:push` command for schema sync
- **Storage layer:** `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class wrapping all Drizzle queries

### Shared Code (shared/)
- `shared/schema.ts` contains Drizzle table definitions and Zod schemas (via drizzle-zod) used by both client and server
- `shared/models/chat.ts` contains conversation/message schemas for the Replit AI chat integration (secondary feature)

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