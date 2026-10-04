import { createServer } from 'node:http';
import app from './app.js';
import { attachSocket } from './socket.js';

const PORT = process.env.PORT || 4000;
const server = createServer(app);
attachSocket(server);
server.listen(PORT, () => console.log(`Chat server running on http://localhost:${PORT}`));
