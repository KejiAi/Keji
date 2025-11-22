import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import { getBackendUrl } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';

// Type definitions for WebSocket messages
interface SocketMessage {
  type: 'chat';
  role: 'assistant';
  content: string;
  message_id: number;
  timestamp: string;
  is_ack?: boolean;
  uploaded_files?: Array<{ name: string; url: string; type?: string; size?: number }>;
  upload_errors?: string[];
  user_message_id?: number;
  client_message_id?: string;
}

interface SocketRecommendation {
  type: 'recommendation';
  role: 'assistant';
  title: string;
  content: string;
  health?: Array<{ label: string; description: string }>;
}

interface SocketChunk {
  type: 'chat_chunk';
  role: 'assistant';
  chunk: string;
  chunk_index: number;
  total_chunks: number;
  is_final: boolean;
  message_group_id: string;
  message_id: number;
  timestamp: string;
}

export interface SocketHistoryMessage {
  message_id?: number;
  text: string;
  sender: string;
  timestamp: string;
  is_chunked?: boolean;
  message_group_id?: string;
  chunk_index?: number;
  total_chunks?: number;
  attachments?: Array<{ name: string; url: string; type?: string; size?: number }>;
}

interface SocketHistory {
  messages: SocketHistoryMessage[];
  has_summary?: boolean;
  summarized_count?: number;
}

interface SocketError {
  message: string;
  details?: string;
}

interface SocketMessageSaved {
  message_id: number;
  timestamp: string;
  client_message_id?: string;
}

export type OutgoingFile = { name: string; size?: number; type?: string; data?: string };

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  connectionAttempts: number;
  hasSyncedHistory: boolean;
  sendMessage: (message: string, files?: OutgoingFile[], clientMessageId?: string) => void;
  acceptRecommendation: (title: string, content: string) => void;
  requestHistory: () => void;
  onReceiveMessage: (callback: (data: SocketMessage) => void) => () => void;
  onReceiveChunk: (callback: (data: SocketChunk) => void) => () => void;
  onReceiveRecommendation: (callback: (data: SocketRecommendation) => void) => () => void;
  onChatHistory: (callback: (data: SocketHistory) => void) => () => void;
  onError: (callback: (data: SocketError) => void) => () => void;
  onMessageSaved: (callback: (data: SocketMessageSaved) => void) => () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [hasSyncedHistory, setHasSyncedHistory] = useState(false);
  const { isAuthenticated, isLoading: sessionLoading } = useSession();
  const socketRef = useRef<Socket | null>(null);
  const eventHandlersRef = useRef<{
    onReceiveMessage: Set<(data: SocketMessage) => void>;
    onReceiveChunk: Set<(data: SocketChunk) => void>;
    onReceiveRecommendation: Set<(data: SocketRecommendation) => void>;
    onChatHistory: Set<(data: SocketHistory) => void>;
    onError: Set<(data: SocketError) => void>;
    onMessageSaved: Set<(data: SocketMessageSaved) => void>;
  }>({
    onReceiveMessage: new Set(),
    onReceiveChunk: new Set(),
    onReceiveRecommendation: new Set(),
    onChatHistory: new Set(),
    onError: new Set(),
    onMessageSaved: new Set(),
  });

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!isAuthenticated) {
      if (socketRef.current) {
        console.log('🔌 Closing WebSocket connection (user not authenticated)');
        socketRef.current.close();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setConnectionAttempts(0);
      setHasSyncedHistory(false);
      return;
    }

    if (socketRef.current) {
      if (!socketRef.current.connected) {
        console.log('🔄 Attempting to reconnect existing socket instance');
        socketRef.current.connect();
      }
      setSocket(socketRef.current);
      return;
    }

    // Initialize socket connection once session is ready and authenticated
    const backendUrl = getBackendUrl();
    console.log('🔌 Initializing WebSocket connection to:', backendUrl);

    type ExtendedSocketOptions = Partial<ManagerOptions & SocketOptions> & {
      pingTimeout?: number;
      pingInterval?: number;
    };

    const socketOptions: ExtendedSocketOptions = {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Retry forever until connected
      reconnectionDelay: 1000, // Start with 1 second
      reconnectionDelayMax: 5000, // Max 5 seconds between retries
      randomizationFactor: 0.5, // Add randomness to prevent thundering herd
      timeout: 120000, // 2 minutes timeout for initial connection
      // Keep connection alive with aggressive ping/pong
      pingTimeout: 60000, // 60 seconds - wait 60s for pong response
      pingInterval: 25000, // 25 seconds - send ping every 25s
    };

    const newSocket = io(backendUrl, socketOptions);

    socketRef.current = newSocket;
    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionAttempts(0);
      setHasSyncedHistory(false);
    });

    newSocket.on('connected', (data) => {
      console.log('✅ WebSocket connection confirmed:', data);
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionAttempts(0);
      setHasSyncedHistory(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setIsConnected(false);
      setHasSyncedHistory(false);
      
      // Only show reconnecting if it's an unexpected disconnect
      if (reason === 'io server disconnect') {
        // Server disconnected (e.g., auth failure) - don't auto-reconnect
        setIsReconnecting(false);
      } else {
        // Client-side disconnect or network issues - will auto-reconnect
        setIsReconnecting(true);
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
      setIsReconnecting(true);
      setConnectionAttempts(attemptNumber);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionAttempts(0);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error);
      setIsReconnecting(true);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed - will keep trying...');
      setIsReconnecting(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
      setIsReconnecting(true);
    });

    // Message event handlers
    newSocket.on('receive_message', (data) => {
      console.log('📨 Received message:', data);
      eventHandlersRef.current.onReceiveMessage.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in receive_message handler:', error);
        }
      });
    });

    newSocket.on('receive_chunk', (data) => {
      console.log('📦 Received chunk:', data.chunk_index + 1, '/', data.total_chunks);
      eventHandlersRef.current.onReceiveChunk.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in receive_chunk handler:', error);
        }
      });
    });

    newSocket.on('receive_recommendation', (data) => {
      console.log('📌 Received recommendation:', data);
      eventHandlersRef.current.onReceiveRecommendation.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in receive_recommendation handler:', error);
        }
      });
    });

    newSocket.on('chat_history', (data) => {
      console.log('📖 Received chat history:', data);
      setHasSyncedHistory(true);
      eventHandlersRef.current.onChatHistory.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in chat_history handler:', error);
        }
      });
    });

    newSocket.on('error', (data) => {
      console.error('⚠️ WebSocket error:', data);
      eventHandlersRef.current.onError.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in error handler:', error);
        }
      });
    });

    newSocket.on('message_saved', (data) => {
      console.log('✅ Message saved:', data);
      eventHandlersRef.current.onMessageSaved.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in message_saved handler:', error);
        }
      });
    });

    newSocket.on('recommendation_saved', (data) => {
      console.log('✅ Recommendation saved:', data);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('🔌 Closing WebSocket connection');
      newSocket.close();
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, sessionLoading]);

  const sendMessage = useCallback((message: string, files?: OutgoingFile[], clientMessageId?: string) => {
    if (!socket || !isConnected) {
      console.error('❌ Cannot send message: Socket not connected');
      return;
    }

    console.log('📤 Sending message:', message);
    socket.emit('send_message', {
      message,
      files: files || [],
      client_message_id: clientMessageId,
    });
  }, [socket, isConnected]);

  const acceptRecommendation = useCallback((title: string, content: string) => {
    if (!socket || !isConnected) {
      console.error('❌ Cannot accept recommendation: Socket not connected');
      return;
    }

    console.log('✅ Accepting recommendation:', title);
    socket.emit('accept_recommendation', {
      title,
      content,
    });
  }, [socket, isConnected]);

  const requestHistory = useCallback(() => {
    if (!socket || !isConnected) {
      console.error('❌ Cannot request history: Socket not connected');
      return;
    }

    console.log('📖 Requesting chat history');
    setHasSyncedHistory(false);
    socket.emit('request_history');
  }, [socket, isConnected]);

  const onReceiveMessage = useCallback((callback: (data: SocketMessage) => void) => {
    eventHandlersRef.current.onReceiveMessage.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onReceiveMessage.delete(callback);
    };
  }, []);

  const onReceiveChunk = useCallback((callback: (data: SocketChunk) => void) => {
    eventHandlersRef.current.onReceiveChunk.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onReceiveChunk.delete(callback);
    };
  }, []);

  const onReceiveRecommendation = useCallback((callback: (data: SocketRecommendation) => void) => {
    eventHandlersRef.current.onReceiveRecommendation.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onReceiveRecommendation.delete(callback);
    };
  }, []);

  const onChatHistory = useCallback((callback: (data: SocketHistory) => void) => {
    eventHandlersRef.current.onChatHistory.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onChatHistory.delete(callback);
    };
  }, []);

  const onError = useCallback((callback: (data: SocketError) => void) => {
    eventHandlersRef.current.onError.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onError.delete(callback);
    };
  }, []);

  const onMessageSaved = useCallback((callback: (data: SocketMessageSaved) => void) => {
    eventHandlersRef.current.onMessageSaved.add(callback);
    return () => {
      eventHandlersRef.current.onMessageSaved.delete(callback);
    };
  }, []);

  const value: SocketContextType = {
    socket,
    isConnected,
    isReconnecting,
    connectionAttempts,
    hasSyncedHistory,
    sendMessage,
    acceptRecommendation,
    requestHistory,
    onReceiveMessage,
    onReceiveChunk,
    onReceiveRecommendation,
    onChatHistory,
    onError,
    onMessageSaved,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

