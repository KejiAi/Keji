import { useEffect, useState } from 'react';

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
  duration = 2000,
}: SlideModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset animation state
      setIsAnimating(false);
      
      // Trigger animation after a brief delay to ensure initial position is set
      const animateTimer = setTimeout(() => {
        setIsAnimating(true);
      }, 50);

      // Auto close after duration
      const closeTimer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => {
          onClose();
        }, 1500); // Wait for slide-out animation
      }, duration);

      return () => {
        clearTimeout(animateTimer);
        clearTimeout(closeTimer);
      };
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none mx-4">
      <div
        className="absolute ease-out pointer-events-auto w-auto"
        style={{
          transition: 'all 1500ms ease-out',
          ...(!isAnimating
            ? {
                left: '0',
                right: '0',
                bottom: '20px',
                transform: 'scale(0.8)',
                opacity: 0.9,
              }
            : {
                left: '0',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%) scale(1)',
                opacity: 1,
              }),
        }}
      >
        <div className="flex items-center gap-3 bg-notifBG text-notifText px-4 py-4 rounded-[24px] font-body font-medium text-xl shadow-lg whitespace-nowrap">

          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-primary text-white text-[3rem] font-body font-bold flex-shrink-0">
            ×
          </div>

          <span className="truncate">{message}</span>
          
        </div>
      </div>
    </div>
  );
}

export default SlideModal;

