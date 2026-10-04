import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import request from 'supertest';
import { io as connect } from 'socket.io-client';

process.env.DB_PATH = ':memory:';
const { default: app } = await import('../src/app.js');
const { attachSocket } = await import('../src/socket.js');

const httpServer = createServer(app);
const io = attachSocket(httpServer);
await new Promise((resolve) => httpServer.listen(0, resolve));
const port = httpServer.address().port;
after(() => io.close());

const waitFor = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

async function signup(username) {
  const res = await request(app).post('/api/auth/register').send({ username, password: 'password123' });
  return res.body.token;
}

test('registration validates username and rejects duplicates', async () => {
  const bad = await request(app).post('/api/auth/register').send({ username: 'a!', password: 'password123' });
  assert.equal(bad.status, 400);
  assert.ok(await signup('alice'));
  const dup = await request(app).post('/api/auth/register').send({ username: 'ALICE', password: 'password123' });
  assert.equal(dup.status, 409);
});

test('rooms require auth, can be created, and general exists', async () => {
  assert.equal((await request(app).get('/api/rooms')).status, 401);
  const token = await signup('bob');
  const h = { Authorization: `Bearer ${token}` };
  const rooms = await request(app).get('/api/rooms').set(h);
  assert.ok(rooms.body.some((r) => r.name === 'general'));
  assert.equal((await request(app).post('/api/rooms').set(h).send({ name: 'dev-team' })).status, 201);
  assert.equal((await request(app).post('/api/rooms').set(h).send({ name: 'dev-team' })).status, 409);
});

test('socket rejects connections without a valid token', async () => {
  const bad = connect(`http://localhost:${port}`, { auth: { token: 'nonsense' }, reconnection: false });
  const err = await waitFor(bad, 'connect_error');
  assert.equal(err.message, 'Unauthorized');
  bad.close();
});

test('real-time messaging: send, broadcast, persist, presence', async () => {
  const t1 = await signup('carol');
  const t2 = await signup('dave');
  const h = { Authorization: `Bearer ${t1}` };
  const roomId = (await request(app).get('/api/rooms').set(h)).body[0].id;

  const carol = connect(`http://localhost:${port}`, { auth: { token: t1 } });
  const dave = connect(`http://localhost:${port}`, { auth: { token: t2 } });
  await Promise.all([waitFor(carol, 'connect'), waitFor(dave, 'connect')]);

  const carolJoined = waitFor(carol, 'presence');
  carol.emit('join_room', roomId);
  await carolJoined;
  const daveJoined = waitFor(dave, 'presence');
  dave.emit('join_room', roomId);
  const presence = await daveJoined;
  assert.deepEqual(presence.users.sort(), ['carol', 'dave']);

  const received = waitFor(dave, 'new_message');
  carol.emit('send_message', { roomId, text: 'hello dave' });
  const msg = await received;
  assert.equal(msg.text, 'hello dave');
  assert.equal(msg.username, 'carol');

  const history = await request(app).get(`/api/rooms/${roomId}/messages`).set(h);
  assert.equal(history.body.at(-1).text, 'hello dave');

  carol.close();
  dave.close();
});
