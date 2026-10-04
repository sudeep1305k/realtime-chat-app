import { useState } from 'react';
import AuthForm from './components/AuthForm.jsx';
import Chat from './components/Chat.jsx';

export default function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return token && user ? { token, user: JSON.parse(user) } : null;
  });

  function handleAuth({ token, user }) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setSession({ token, user });
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession(null);
  }

  return session ? (
    <Chat token={session.token} user={session.user} onLogout={handleLogout} />
  ) : (
    <AuthForm onAuth={handleAuth} />
  );
}
