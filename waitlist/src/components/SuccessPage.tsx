interface SuccessPageProps {
  onClose?: () => void;
}

function SuccessPage({ onClose }: SuccessPageProps) {
  return (
    <div className="fixed inset-0 bg-primary flex items-center justify-center p-8 z-50">
      <div className="text-center max-w-sm">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-white rounded-full flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="w-12 h-12 text-primary" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={3} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-heading font-bold text-white text-4xl mb-4">
          You're on the list!
        </h1>

        {/* Message */}
        <p className="font-body font-medium text-white text-lg mb-8 leading-relaxed">
          Thank you for joining the Keji waitlist! We will reach out to you soon with exciting updates. Keep an eye on your inbox.
        </p>

        {/* Subtext */}
        <p className="font-body text-white/70 text-sm mb-8">
          You can safely close this tab now.
        </p>

        {/* Optional: Back to Home Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="font-body font-medium text-primary bg-white px-8 py-3 rounded-full text-lg hover:bg-white/90 transition-colors"
          >
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
}

export default SuccessPage;

