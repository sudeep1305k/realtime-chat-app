import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const ROOM_RE = /^[A-Za-z0-9 _-]{2,30}$/;

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT id, name FROM rooms ORDER BY name').all());
});

router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!ROOM_RE.test(name)) {
    return res.status(400).json({ error: 'Room name must be 2-30 letters, numbers, spaces, - or _' });
  }
  if (db.prepare('SELECT id FROM rooms WHERE name = ?').get(name)) {
    return res.status(409).json({ error: 'Room already exists' });
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO rooms (name) VALUES (?)').run(name);
  res.status(201).json({ id: Number(lastInsertRowid), name });
});

router.get('/:id/messages', (req, res) => {
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = db
    .prepare(
      `SELECT m.id, m.room_id, u.username, m.text, m.created_at
       FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ? ORDER BY m.id DESC LIMIT ?`
    )
    .all(room.id, limit);
  res.json(rows.reverse()); // oldest first
});

export default router;
