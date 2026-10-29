import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // In dev or unified deploy: uses '/', or explicit backend URL via VITE_API_URL
    const backendUrl = (import.meta.env.VITE_API_URL || '').trim() || '/';
    const socketInstance = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      if (user?.role === 'admin') {
        socketInstance.emit('join_admin_bridge', {
          name: user.name,
          badgeId: user.badgeId
        });
      }
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.role]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  return ctx || { socket: null, connected: false };
}
