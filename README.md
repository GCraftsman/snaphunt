# SnapHunt

  > Real-time multiplayer photo & video scavenger hunt PWA

  A team-based scavenger hunt game where a proctor creates hunts with custom items, players join via a 6-character code or QR, compete to photograph (or video) items during a timed game, and submissions are verified by AI (OpenAI vision) or the proctor manually.

  ## Features

  - **Draft hunts** — create and edit hunts before opening the lobby
  - **Real-time multiplayer** — WebSocket-powered state sync across all players
  - **AI photo verification** — OpenAI vision API checks submissions automatically
  - **Video submissions** — configurable recording length with background upload
  - **Bonus points system** — if/for/for_each bonus types with proctor review queue
  - **GPS location tracking** — optional live map of players during the game
  - **Post-game replay** — animated player trail map with timeline scrubber
  - **Camera zoom** — pinch-to-zoom / slider on supported mobile devices
  - **PWA** — installable on iOS and Android from the browser
  - **Native mobile** — Capacitor config ready for App Store / Play Store builds

  ## Tech Stack

  | Layer | Technology |
  |---|---|
  | Frontend | React + TypeScript + Vite |
  | UI | shadcn/ui (Radix) + Tailwind CSS v4 |
  | Routing | Wouter |
  | Data | TanStack React Query |
  | Backend | Express 5 + Node.js + TypeScript |
  | Real-time | WebSockets (ws) |
  | Database | PostgreSQL + Drizzle ORM |
  | Auth | Replit Auth (OpenID Connect) |
  | AI | OpenAI GPT-4 Vision |
  | Maps | Leaflet |
  | Native | Capacitor |

  ## Getting Started

  ```bash
  npm install
  npm run dev
  ```

  Set the following environment variables:
  - `DATABASE_URL` — PostgreSQL connection string
  - `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI API base URL
  - `SESSION_SECRET` — Express session secret

  ## Building for Native Mobile

  ```bash
  # 1. Build web assets
  npm run build

  # 2. Add native platforms (requires Xcode / Android Studio)
  npx cap add ios
  npx cap add android

  # 3. Sync and open
  npx cap sync
  npx cap open ios      # opens Xcode
  npx cap open android  # opens Android Studio
  ```

  ## CI / CD

  GitHub Actions workflows are in `.github/workflows/`:
  - **ci.yml** — type-check and web build on every push
  - **build-ios.yml** — archive and export IPA (macOS runner, requires Apple signing secrets)
  - **build-android.yml** — build signed AAB for Play Store (requires keystore secrets)

  See `.github/ExportOptions.plist.template` for iOS signing setup instructions.

  ### Required GitHub Secrets

  | Secret | Used by |
  |---|---|
  | `BUILD_CERTIFICATE_BASE64` | iOS — base64 .p12 certificate |
  | `P12_PASSWORD` | iOS — .p12 password |
  | `KEYCHAIN_PASSWORD` | iOS — temp keychain password |
  | `PROVISIONING_PROFILE_BASE64` | iOS — base64 .mobileprovision |
  | `APPLE_TEAM_ID` | iOS — Apple Developer Team ID |
  | `EXPORT_OPTIONS_PLIST` | iOS — base64 ExportOptions.plist |
  | `KEYSTORE_BASE64` | Android — base64 .keystore file |
  | `KEYSTORE_PASSWORD` | Android — keystore password |
  | `KEY_ALIAS` | Android — key alias |
  | `KEY_PASSWORD` | Android — key password |

  ## License

  MIT
  