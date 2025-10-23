import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from '@/lib/utils';

// Type definitions for WebSocket messages
interface SocketMessage {
  type: 'chat';
  role: 'assistant';
  content: string;
  message_id: number;
  timestamp: string;
}

interface SocketRecommendation {
  type: 'recommendation';
  role: 'assistant';
  title: string;
  content: string;
  health?: Array<{ label: string; description: string }>;
}

interface SocketHistoryMessage {
  text: string;
  sender: string;
  timestamp: string;
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

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (message: string, files?: File[]) => void;
  acceptRecommendation: (title: string, content: string) => void;
  requestHistory: () => void;
  onReceiveMessage: (callback: (data: SocketMessage) => void) => () => void;
  onReceiveRecommendation: (callback: (data: SocketRecommendation) => void) => () => void;
  onChatHistory: (callback: (data: SocketHistory) => void) => () => void;
  onError: (callback: (data: SocketError) => void) => () => void;
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
  const eventHandlersRef = useRef<{
    onReceiveMessage: Set<(data: SocketMessage) => void>;
    onReceiveRecommendation: Set<(data: SocketRecommendation) => void>;
    onChatHistory: Set<(data: SocketHistory) => void>;
    onError: Set<(data: SocketError) => void>;
  }>({
    onReceiveMessage: new Set(),
    onReceiveRecommendation: new Set(),
    onChatHistory: new Set(),
    onError: new Set(),
  });

  useEffect(() => {
    // Initialize socket connection
    const backendUrl = getBackendUrl();
    console.log('🔌 Initializing WebSocket connection to:', backendUrl);

    const newSocket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 120000, // 2 minutes timeout for initial connection
      // No timeout for message responses - wait indefinitely
      ackTimeout: 300000, // 5 minutes for acknowledgments (very long processing)
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('connected', (data) => {
      console.log('✅ WebSocket connection confirmed:', data);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
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
    });

    newSocket.on('recommendation_saved', (data) => {
      console.log('✅ Recommendation saved:', data);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      console.log('🔌 Closing WebSocket connection');
      newSocket.close();
    };
  }, []);

  const sendMessage = useCallback((message: string, files?: File[]) => {
    if (!socket || !isConnected) {
      console.error('❌ Cannot send message: Socket not connected');
      return;
    }

    console.log('📤 Sending message:', message);
    socket.emit('send_message', {
      message,
      files: files || [],
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
    socket.emit('request_history');
  }, [socket, isConnected]);

  const onReceiveMessage = useCallback((callback: (data: SocketMessage) => void) => {
    eventHandlersRef.current.onReceiveMessage.add(callback);
    // Return cleanup function
    return () => {
      eventHandlersRef.current.onReceiveMessage.delete(callback);
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

  const value: SocketContextType = {
    socket,
    isConnected,
    sendMessage,
    acceptRecommendation,
    requestHistory,
    onReceiveMessage,
    onReceiveRecommendation,
    onChatHistory,
    onError,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

