const BASE = '/api';

export const getToken = () => localStorage.getItem('token');

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  register: (body) => request('/auth/register', post(body)),
  login: (body) => request('/auth/login', post(body)),
  listRooms: () => request('/rooms'),
  createRoom: (name) => request('/rooms', post({ name })),
  messages: (roomId) => request(`/rooms/${roomId}/messages`),
};
