import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface AuthContextType {
  user: any | null;
  dbUser: any | null;
  idToken: string | null;
  socket: Socket | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  idToken: null,
  socket: null,
  loading: true,
  signInWithEmail: async () => {},
  logout: async () => {},
  getToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [dbUser, setDbUser] = useState<any | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Try restore local token
    const localToken = localStorage.getItem('localAuthToken');
    if (localToken) {
      setIdToken(localToken);
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localToken}` },
      })
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setDbUser(data);
            setUser({ displayName: data.name, email: data.email });
          } else {
            localStorage.removeItem('localAuthToken');
            setIdToken(null);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Connect realtime socket when idToken is available
  useEffect(() => {
    if (!idToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const s = io('/', { auth: { token: idToken } });
    setSocket(s);
    s.on('connect', () => {
      console.log('Realtime socket connected');
    });
    s.on('connect_error', (err: any) => {
      console.error('Realtime socket connect_error', err);
    });

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [idToken]);

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const { token, user: dbUserResponse } = await res.json();
      localStorage.setItem('localAuthToken', token);
      setIdToken(token);
      setDbUser(dbUserResponse);
      setUser({ displayName: dbUserResponse.name, email: dbUserResponse.email });
    } catch (err) {
      console.error('Email Sign-In failed:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('localAuthToken');
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setUser(null);
      setDbUser(null);
      setIdToken(null);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  const getToken = async () => {
    const localToken = localStorage.getItem('localAuthToken');
    if (localToken) return localToken;
    return null;
  };

  return (
    <AuthContext.Provider
      value={{ user, dbUser, idToken, socket, loading, signInWithEmail, logout, getToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
