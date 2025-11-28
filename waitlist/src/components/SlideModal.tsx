import { useEffect } from 'react';

interface SlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  duration?: number; // Duration in milliseconds
}

function SlideModal({
  isOpen,
  onClose,
  message = 'Nice choice!',
  duration = 3000,
}: SlideModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Auto close after duration (3 seconds default)
      const closeTimer = setTimeout(() => {
        onClose();
      }, duration);

      return () => {
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto">
        <div className="flex items-center gap-2 bg-notifBG text-notifText px-3 py-2 rounded-[16px] font-body font-medium text-base shadow-lg">

          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white text-2xl font-body font-bold flex-shrink-0">
            ×
          </div>

          <span>{message}</span>
          
        </div>
      </div>
    </div>
  );
}

export default SlideModal;

