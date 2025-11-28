import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  formField?: {
    label: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'password' | 'number' | 'tel';
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
  };
  onSubmit?: (value: string) => void;
  submitLabel?: string;
}

function Modal({
  isOpen,
  onClose,
}: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset form values when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setEmail('');
      setPhone('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  // Handle animation and ESC key
  useEffect(() => {
    if (isOpen) {
      // Reset animation state
      setIsAnimating(false);
      
      // Trigger slide-in animation after a brief delay
      const animateTimer = setTimeout(() => {
        setIsAnimating(true);
      }, 50);

      // Handle ESC key to close modal
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
          setIsAnimating(false);
          setTimeout(() => {
            onClose();
          }, 500);
        }
      };

      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(animateTimer);
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
      };
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, phone }),
      });

      // Handle empty or invalid responses
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server. Please check your API configuration.');
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server. Make sure you are running with Vercel CLI (vercel dev) for local development.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);
      console.error('Submission error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6 z-50 pointer-events-none">
      {/* Modal Container */}
      <div 
        className="bg-white w-full max-w-sm rounded-[30px] p-6 shadow-xl relative pointer-events-auto transition-all duration-500 ease-out"
        style={{
          transform: isAnimating 
            ? 'translateY(0) scale(1)' 
            : 'translateY(100vh) scale(0.95)',
          opacity: isAnimating ? 1 : 0.9,
        }}
      >

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-8 right-4 text-black"
          aria-label="Close modal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Heading */}
        <h2 className="font-heading font-bold text-3xl text-black mt-10">
          Join Waitlist
        </h2>
        <p className="font-body text-form mt-1 text-sm">
          Fill in the form, to join the waitlist
        </p>

        {/* Form */}
        <form className="mt-10 space-y-5" onSubmit={handleSubmit}>

          {/* First Name */}
          <div>
            <label className="font-body text-form text-sm mb-1 block">First Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g Timee, or John"
              required
              className="w-full px-4 py-[1rem] rounded-xl border border-borderLine font-body text-black placeholder-black/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Email */}
          <div>
            <label className="font-body text-form text-sm mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g timee@gmail.com"
              required
              className="w-full px-4 py-[1rem] rounded-xl border border-borderLine font-body text-black placeholder-black/40 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="font-body text-form text-sm mb-1 block">
              Phone No (WhatsApp):
            </label>

            {/* Parent container with border + background */}
            <div className="flex bg-realWhite items-center gap-2 w-full px-4 py-[1rem] rounded-xl border border-borderLine focus-within:ring-1 focus-within:ring-primary">

              {/* Nigeria Flag */}
              <img
                src="/assets/all_icons_used/emojione_flag-for-nigeria.png"
                alt="NG"
                className="w-4 h-4"
              />

              {/* Input (no border) */}
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g 812 345 6789"
                required
                className="flex-1 font-body text-black placeholder-black/40 border-none focus:outline-none"
              />

            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          {/* Success Message */}
          {success && (
            <div className="text-green-500 text-sm text-center">Successfully added to waitlist!</div>
          )}

          <div className="flex items-center justify-center max-w-[250px] mx-auto">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-6 px-14 rounded-[32px] text-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Submitting...' : 'Join Waitlist'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default Modal;

