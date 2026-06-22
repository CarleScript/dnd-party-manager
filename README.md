# ⚔️ D&D Party Manager 🐉

[![Version](https://img.shields.io/github/package-json/v/CarleScript/dnd-party-manager?label=version&color=blue)](https://github.com/CarleScript/dnd-party-manager/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=18.0.0-339933?logo=node.js)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.0.5-f69220?logo=pnpm)](https://pnpm.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8.3-010101?logo=socket.io)](https://socket.io/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

A modern, real-time web application built for Dungeon Masters and Players to seamlessly manage Dungeons & Dragons sessions. It provides instant synchronization for initiative orders, player status, and (coming soon) integrated character sheets.

## ✨ Features

### 🎲 Gameplay Features
* **Role Management:** Differentiates between `Master (DM)` and `Player` roles.
* **NPC Integration:** Allows the DM to inject `non-playable (NPC)` characters into the initiative order.
* **Stats Tracking:** Monitors `Initiative` and `HP` in real time directly from the initiative board, with DM override capabilities.
* **PDF Character Sheets:** Integrates an in-app PDF reader so players can view their stats and initiative in the same tab.

### 🛠️ Current Capabilities
* **Real-Time Synchronization:** Powered by `Socket.io` for instant updates across all connected devices.
* **Session Persistence:** Remembers user sessions via `localStorage` to survive accidental refreshes or disconnects.
* **Smart Reconnection:** Handles mobile browser throttling and screen locks gracefully with native `Page Visibility API` integration.

### 🏗️ Roadmap (Coming Soon)
- [x] **Toast Notifications:** Clean, modern UI alerts to replace native browser popups.
- [ ] **Server-Side Persistence:** Database integration (SQLite3) to ensure party state and initiative data survive server restarts.
- [ ] **Thematic UI/UX Polish:** Implementing a mobile-first, D&D-inspired visual design with responsive layouts and immersive dark-mode aesthetics.
- [ ] **Dice Roller:** Add a built-in dice rolling tool for quick and easy dice throws.

## 💻 Tech Stack

* **Backend:** Node.js, Express
* **Real-Time Engine:** Socket.io
* **Frontend:** Vanilla JS (ES Modules), HTML5, CSS3
* **Package Manager:** pnpm
* **Containerization:** Docker

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js (v18+) installed. This project uses `pnpm` for package management.

```bash
npm install -g pnpm
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CarleScript/dnd-party-manager.git
cd dnd-party-manager
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
Copy the example environment file and adjust it to your needs.
```bash
cp .env.example .env
```

### Environment Variables (`.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | The port on which the Express server will run. |
| `NODE_ENV` | `development` | Defines the environment (`development` or `production`). |
| `USER_STATE_STORAGE_KEY`| `dnd_party_manager...` | The `localStorage` key used to persist client sessions. |
| `ROOM_CAPACITY` | `10` | Maximum number of players allowed in a single party. |
| `MAX_NAME_LENGTH` | `30` | Character limit for player usernames. |
| `SOCKET_DISCONNECT_TIMEOUT_MS` | `600000` | Time (in ms) before an offline user is removed from the party. |

### Running the Server

**For Development (with auto-reload):**
```bash
pnpm run dev
```

**For Production:**
```bash
pnpm start
```

Once running, navigate to `http://localhost:<PORT>` in your browser.

### 🐳 Running with Docker

You don't need Node.js or pnpm installed locally — Docker builds and runs everything in an isolated container. You only need a `.env` file (see above).

1. Build the image:
```bash
docker build -t dnd-party-manager .
```

2. Run the container:
```bash
docker run -d \
  --name dnd-party-manager \
  -p 3000:3000 \
  --env-file .env \
  --restart=unless-stopped \
  dnd-party-manager
```

A few things the image does by design:
* **Non-root:** runs as the unprivileged `node` user.
* **Production mode:** `NODE_ENV=production` is baked in; config is injected at runtime via `--env-file`, so the same image works in any environment.
* **Graceful shutdown:** handles `SIGTERM`/`SIGINT`, so `docker stop` closes connections cleanly instead of being killed.
* **Resilient:** `--restart=unless-stopped` brings it back after a crash or reboot (but stays down if you stop it yourself with `docker stop`).

> If you change `PORT` in your `.env`, update the right-hand side of `-p 3000:3000` to match.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
