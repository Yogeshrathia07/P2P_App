import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { generateRandomRoomCode } from '../utils/roomUtils';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const userRef = useRef(user);
  const navigateRef = useRef(navigate);
  const [isConnected, setIsConnected] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [queueData, setQueueData] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingMatch, setPendingMatch] = useState(null);
  const [matchConfirmed, setMatchConfirmed] = useState(null);

  useEffect(() => {
    userRef.current = user;
    navigateRef.current = navigate;
  }, [user, navigate]);

  // Initialize socket instance once across entire app lifecycle
  useEffect(() => {
    const isVercel =
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('.vercel.app');

    const backendOrigin =
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL ||
      (isVercel ? 'https://peerforge-backend.onrender.com' : (typeof window !== 'undefined' ? window.location.origin : '/'));

    const socket = io(backendOrigin, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        const token = localStorage.getItem('auth_token');
        const currentUser = userRef.current;
        cb({
          token,
          user: currentUser
            ? {
                _id: currentUser.id || currentUser._id,
                name: currentUser.name,
                email: currentUser.email,
              }
            : null,
        });
      },
    });

    socketRef.current = socket;

    if (socket.connected) {
      setIsConnected(true);
    }

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected to server:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connect error:', err.message);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setInQueue(false);
      setPendingMatch(null);
      console.log('[Socket] Disconnected from server:', reason);
    });

    socket.on('match:found', (data) => {
      console.log('[Socket] Match found:', data);
      setPendingMatch(data);
    });

    socket.on('match:confirmed', (data) => {
      console.log('[Socket] Match confirmed, room ready:', data);
      setPendingMatch(null);
      setInQueue(false);
      setMatchConfirmed(data);
      if (navigateRef.current) {
        navigateRef.current(`/room/${data.roomId}`);
      }
    });

    socket.on('match:cancelled', ({ reason, reQueued }) => {
      console.log('[Socket] Match cancelled:', reason);
      setPendingMatch(null);
      if (reQueued) {
        setInQueue(true);
      }
    });

    socket.on('queue:left', () => {
      setInQueue(false);
      setQueueData(null);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update socket credentials and authenticate whenever user state changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (user) {
      const authPayload = {
        token: localStorage.getItem('auth_token'),
        user: { _id: user.id || user._id, name: user.name, email: user.email },
      };
      socket.auth = authPayload;
      if (!socket.connected) {
        socket.connect();
      } else {
        socket.emit('user:authenticate', authPayload);
      }
    }
  }, [user]);

  // Stopwatch timer when in queue
  useEffect(() => {
    let timer = null;
    if (inQueue && !pendingMatch) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (!inQueue) {
      setElapsedSeconds(0);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inQueue, pendingMatch]);

  const joinQueue = useCallback(({ track, difficulty }) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    setElapsedSeconds(0);
    setInQueue(true);
    setQueueData({ track, difficulty, joinedAt: Date.now() });

    socket.emit('queue:join', { track, difficulty });
  }, []);

  const leaveQueue = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    setInQueue(false);
    setQueueData(null);
    setElapsedSeconds(0);
    socket.emit('queue:leave');
  }, []);

  const acceptMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('match:accept', { matchId });
  }, []);

  const declineMatch = useCallback((matchId) => {
    const socket = socketRef.current;
    if (!socket) return;

    setPendingMatch(null);
    socket.emit('match:decline', { matchId });
  }, []);

  const createDirectInvite = useCallback(({ track, difficulty, roomCode }) => {
    return new Promise((resolve) => {
      const fallbackCode = roomCode || generateRandomRoomCode();
      const socket = socketRef.current;

      if (!socket || !socket.connected) {
        return resolve({
          success: true,
          roomCode: fallbackCode,
          roomId: fallbackCode,
          inviteCode: fallbackCode,
          track,
          difficulty,
        });
      }

      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({
            success: true,
            roomCode: fallbackCode,
            roomId: fallbackCode,
            inviteCode: fallbackCode,
            track,
            difficulty,
          });
        }
      }, 1000);

      socket.emit('invite:create', { track, difficulty, roomCode: fallbackCode }, (res) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (res && res.success) {
            resolve({
              ...res,
              roomCode: res.roomCode || res.roomId || fallbackCode,
            });
          } else {
            resolve({
              success: true,
              roomCode: fallbackCode,
              roomId: fallbackCode,
              inviteCode: fallbackCode,
              track,
              difficulty,
            });
          }
        }
      });
    });
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    inQueue,
    queueData,
    elapsedSeconds,
    pendingMatch,
    matchConfirmed,
    joinQueue,
    leaveQueue,
    acceptMatch,
    declineMatch,
    createDirectInvite,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;

