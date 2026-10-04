import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { SECRET } from './middleware/auth.js';

const roomKey = (id) => `room:${id}`;

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' },
  });

  // Reject the connection unless the JWT is valid and the user still exists.
  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, SECRET);
      const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(Number(payload.sub));
      if (!user) throw new Error('unknown user');
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  async function broadcastPresence(roomId) {
    const sockets = await io.in(roomKey(roomId)).fetchSockets();
    const users = [...new Set(sockets.map((s) => s.data.user.username))].sort();
    io.to(roomKey(roomId)).emit('presence', { roomId, users });
  }

  io.on('connection', (socket) => {
    socket.on('join_room', async (roomId) => {
      const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
      if (!room) return;
      const previous = socket.data.roomId;
      if (previous && previous !== room.id) {
        socket.leave(roomKey(previous));
        await broadcastPresence(previous);
      }
      socket.join(roomKey(room.id));
      socket.data.roomId = room.id;
      await broadcastPresence(room.id);
    });

    socket.on('send_message', ({ roomId, text } = {}) => {
      const clean = String(text ?? '').trim();
      if (!clean || clean.length > 1000) return;
      if (socket.data.roomId !== roomId) return; // must be in the room to post
      const { lastInsertRowid } = db
        .prepare('INSERT INTO messages (room_id, user_id, text) VALUES (?, ?, ?)')
        .run(roomId, socket.data.user.id, clean);
      const message = db
        .prepare(
          `SELECT m.id, m.room_id, u.username, m.text, m.created_at
           FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
        )
        .get(lastInsertRowid);
      io.to(roomKey(roomId)).emit('new_message', message);
    });

    socket.on('typing', ({ roomId } = {}) => {
      if (socket.data.roomId !== roomId) return;
      socket.to(roomKey(roomId)).emit('typing', { roomId, username: socket.data.user.username });
    });

    socket.on('disconnect', () => {
      if (socket.data.roomId) broadcastPresence(socket.data.roomId);
    });
  });

  return io;
}
