# Realtime Chat (Full Stack)

![CI](https://github.com/sudeep1305k/realtime-chat-app/actions/workflows/ci.yml/badge.svg)

A real-time chat application with rooms, persistent message history, live online users and typing indicators.

**Stack:** React 18 (Vite) · Node.js + Express · Socket.IO · SQLite (better-sqlite3) · JWT auth · bcrypt · GitHub Actions CI

## Features
- Sign up / log in with JWT; **sockets are authenticated too** (connections without a valid token are rejected)
- Multiple chat rooms, create your own rooms
- Messages broadcast instantly to everyone in the room and are saved, so history loads when you join
- Live "online in this room" list (presence) and "user is typing..." indicator
- Server-side validation (message length, room names, username rules)
- Automated tests covering REST endpoints **and** a real Socket.IO client/server exchange

## Project structure
```
chat-app/
  server/   Express REST API + Socket.IO (src/socket.js) + tests
  client/   React app (Vite)
```

## Run locally
Open **two terminals**.

Terminal 1 (server):
```bash
cd server
npm install
npm run dev
```
Terminal 2 (client):
```bash
cd client
npm install
npm run dev
```
Open http://localhost:5173 in **two different browsers** (or one normal and one private window), sign up as two users and chat.

## Run tests
```bash
cd server
npm test
```

## Production build
```bash
cd client && npm run build
cd ../server && npm start
```
Express serves `client/dist`, so the whole app runs on one port.

## How real-time works
1. The client logs in over REST and receives a JWT.
2. It opens a Socket.IO connection sending the JWT in the handshake; a server middleware verifies it.
3. `join_room` puts the socket into a Socket.IO room; the server then broadcasts the list of online users.
4. `send_message` is validated, saved to SQLite, then broadcast to the room as `new_message`.

## Design decisions
- **Messages are stored before being broadcast**, so what users see always matches the database.
- **A user must be in a room to post to it**; the server checks this on every message.
- **Typing events are throttled** on the client to one per second to avoid flooding.
- **Single process, SQLite**: simple to run. Scaling to several servers would need a Socket.IO Redis adapter and PostgreSQL.

## Future improvements
Private direct messages, read receipts, message pagination, image uploads, Redis adapter for scaling.

## What I learned
WebSocket authentication, room-based broadcasting, presence tracking, and testing real-time code with a socket client.
