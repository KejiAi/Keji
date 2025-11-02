import React from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, isReconnecting, connectionAttempts } = useSocket();

  // Don't show anything when connected and not reconnecting
  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in-0">
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg
          backdrop-blur-sm border
          ${
            isReconnecting
              ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-300'
              : 'bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300'
          }
        `}
      >
        {isReconnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {connectionAttempts > 0
                ? `Reconnecting... (Attempt ${connectionAttempts})`
                : 'Reconnecting...'}
            </span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Disconnected</span>
          </>
        )}
      </div>
    </div>
  );
};


