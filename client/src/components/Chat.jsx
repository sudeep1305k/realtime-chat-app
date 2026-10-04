import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api.js';

const formatTime = (iso) =>
  new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Chat({ token, user, onLogout }) {
  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const [text, setText] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const activeRef = useRef(null); // lets socket callbacks see the latest active room
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  // Open one socket connection for the lifetime of this component.
  useEffect(() => {
    const socket = io({ auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (activeRef.current != null) socket.emit('join_room', activeRef.current); // rejoin after reconnect
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'Unauthorized') onLogout();
    });
    socket.on('new_message', (msg) => {
      if (msg.room_id === activeRef.current) setMessages((prev) => [...prev, msg]);
    });
    socket.on('presence', ({ roomId, users }) => {
      if (roomId === activeRef.current) setOnline(users);
    });
    socket.on('typing', ({ roomId, username }) => {
      if (roomId !== activeRef.current) return;
      setTypingUser(username);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(''), 1500);
    });

    return () => socket.disconnect();
  }, [token, onLogout]);

  useEffect(() => {
    api
      .listRooms()
      .then((list) => {
        setRooms(list);
        if (list.length) setActiveId(list[0].id);
      })
      .catch((err) => (err.status === 401 ? onLogout() : setError(err.message)));
  }, [onLogout]);

  // Whenever the active room changes: load history and join its socket room.
  useEffect(() => {
    if (activeId == null) return;
    setMessages([]);
    setOnline([]);
    setTypingUser('');
    api.messages(activeId).then(setMessages).catch((err) => setError(err.message));
    socketRef.current?.emit('join_room', activeId);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e) {
    e.preventDefault();
    if (!text.trim() || activeId == null) return;
    socketRef.current.emit('send_message', { roomId: activeId, text });
    setText('');
  }

  function onType(e) {
    setText(e.target.value);
    const now = Date.now();
    if (now - lastTypingSent.current > 1000) {
      lastTypingSent.current = now; // throttle typing events to one per second
      socketRef.current?.emit('typing', { roomId: activeId });
    }
  }

  async function addRoom(e) {
    e.preventDefault();
    if (!newRoom.trim()) return;
    try {
      const room = await api.createRoom(newRoom.trim());
      setRooms((prev) => [...prev, room].sort((a, b) => a.name.localeCompare(b.name)));
      setActiveId(room.id);
      setNewRoom('');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  const activeRoom = rooms.find((r) => r.id === activeId);

  return (
    <div className="chat">
      <aside className="sidebar">
        <div className="sidebar-head">
          <strong>@{user.username}</strong>
          <button className="secondary small" onClick={onLogout}>
            Log out
          </button>
        </div>
        <h3>Rooms</h3>
        <ul className="rooms">
          {rooms.map((r) => (
            <li key={r.id}>
              <button className={r.id === activeId ? 'room active' : 'room'} onClick={() => setActiveId(r.id)}>
                # {r.name}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addRoom} className="new-room">
          <input placeholder="New room name" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} />
          <button>+</button>
        </form>
        {error && <div className="error">{error}</div>}
        <h3>Online ({online.length})</h3>
        <ul className="online">
          {online.map((name) => (
            <li key={name}>
              <span className="dot" /> {name}
            </li>
          ))}
        </ul>
      </aside>

      <main className="main">
        <header className="room-title">{activeRoom ? `# ${activeRoom.name}` : 'Select a room'}</header>
        <div className="messages">
          {messages.map((m) => (
            <div key={m.id} className={m.username.toLowerCase() === user.username.toLowerCase() ? 'msg mine' : 'msg'}>
              <div className="meta">
                <strong>{m.username}</strong> <span className="muted">{formatTime(m.created_at)}</span>
              </div>
              <div className="bubble">{m.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="typing">{typingUser ? `${typingUser} is typing...` : '\u00A0'}</div>
        <form className="composer" onSubmit={send}>
          <input placeholder="Type a message..." value={text} onChange={onType} maxLength={1000} />
          <button>Send</button>
        </form>
      </main>
    </div>
  );
}
