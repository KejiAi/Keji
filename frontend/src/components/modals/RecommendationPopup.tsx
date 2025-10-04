import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/lib/utils";
import { useState } from "react";

interface RecommendationPopupProps {
  recommendation: {
    title: string;
    content: string;
    health?: Array<{ label: string; description: string }>;
  } | null;
  onClose: () => void;
  onAccept: (acceptanceMessage: string) => void;
}

const RecommendationPopup = ({ recommendation, onClose, onAccept }: RecommendationPopupProps) => {
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  
  if (!recommendation) return null;

  // Handle backdrop click for cancellation
  const handleBackdropClick = () => {
    if (!showHealthModal) {
      onClose();
    }
  };

  const handleCloseHealthModal = () => {
    setShowHealthModal(false);
    // Delay removal of health modal until slide animation completes
    setTimeout(() => {
      setIsHealthModalVisible(false);
    }, 300);
  };

  const handleOpenHealthModal = () => {
    setShowHealthModal(true);
    setIsHealthModalVisible(true);
  };

  const handleAccept = async () => {
    try {
      // Send title and content to backend
      const response = await fetch(`${getBackendUrl()}/accept_recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: recommendation.title,
          content: recommendation.content
        })
      });

      if (response.ok) {
        // Use the title as the acceptance message
        const acceptanceMessage = `Thanks, I'm eating ${recommendation.title}`;
        onAccept(acceptanceMessage);
      } else {
        console.error('Failed to accept recommendation');
        // Still proceed with acceptance even if backend fails
        const acceptanceMessage = `${recommendation.title} not received. Lets do this again`;
        onAccept(acceptanceMessage);
      }
    } catch (error) {
      console.error('Error accepting recommendation:', error);
      // Still proceed with acceptance even if backend fails
      const acceptanceMessage = `${recommendation.title} not received. Lets do this again`;
      onAccept(acceptanceMessage);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-background overflow-x-hidden">
      {/* Backdrop overlay for cancellation */}
      <div 
        className="absolute inset-0 z-10 bg-transparent"
        onClick={handleBackdropClick}
      />

      {/* Recommendation Card Container */}
      <div 
        className={`relative z-20 flex flex-col justify-start items-center pt-16 px-2 transition-transform duration-300 ${
          showHealthModal ? 'translate-x-[88%] pointer-events-none' : 'translate-x-0'
        }`}
      >
        <div className="w-full max-w-md mx-auto">
          {/* Card */}
          <div className="relative bg-muted rounded-2xl shadow-sm p-4" onClick={(e) => e.stopPropagation()}>
            {/* Top Section */}
            <div className="bg-white rounded-xl px-6 py-8 h-[19rem] overflow-y-auto">
              <h2 className="text-3xl font-[500] text-black mb-4 leading-none">
                {recommendation.title}
              </h2>
              <div className="text-gray-500 text-lg leading-tight">
                {recommendation.content}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="mt-4 flex justify-between items-center justify-center">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={showHealthModal}
                  className="bg-black text-white hover:bg-gray-800 border-black rounded-full px-5 h-10 text-xl font-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  No
                </Button>

                <Button
                  onClick={handleAccept}
                  disabled={showHealthModal}
                  className="bg-budget-red hover:bg-red-600 text-white rounded-full px-5 h-10 text-xl font-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  I will eat this
                </Button>
              </div>

              {/* Health Icon */}
              <div className="flex-shrink-0">
                <button 
                  onClick={handleOpenHealthModal}
                  disabled={!recommendation.health}
                  className="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" 
                >
                  <img
                    src="/assets/All Icon Used/material-symbols-light_health-and-safety.png"
                    alt="Health icon"
                    className="w-10 h-10 object-contain"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Chat Bubbles Below Recommendation */}
      <div className="w-full max-w-md mx-auto space-y-4 mt-6 px-2">
        {/* User message */}
        <div className="flex flex-col items-end">
          <div className="flex flex-col items-end max-w-[75%]">
            <div className="px-3 py-1 rounded-[0.8rem] bg-ingredient-green text-ingredient-green-foreground rounded-br-none">
              <p className="text-sm sm:text-base break-words whitespace-pre-wrap leading-relaxed">
                Thanks, I'm eating this
              </p>
            </div>
            <div className="text-[10px] text-gray-400 mt-1 text-right">
              10:37
            </div>
          </div>
        </div>

        {/* AI message */}
        <div className="flex flex-col items-start">
          <div className="flex w-full max-w-[75%] gap-2">
            {/* Avatar/logo */}
            <div className="w-7 h-7 flex-shrink-0 bg-white rounded-full overflow-hidden flex items-center justify-center">
              <img
                src="/assets/Asset 1@2x.png"
                alt="logo"
                className="w-3 h-3 object-cover"
              />
            </div>

            {/* Bubble + timestamp */}
            <div className="flex flex-col items-start max-w-full">
              <div className="px-3 py-1 rounded-[0.8rem] bg-white text-foreground rounded-bl-none">
                <p className="text-sm sm:text-base break-words whitespace-pre-wrap leading-relaxed">
                  Anytime, man. I gatch you.
                </p>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 text-left">
                10:37
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Health Modal */}
      {isHealthModalVisible && recommendation.health && (
        <div className="absolute inset-0 z-10 flex justify-center items-start pt-16 px-2">
          <div className="w-full max-w-md mx-auto">
            {/* Modal */}
            <div className="relative bg-background px-4 pb-4" onClick={(e) => e.stopPropagation()}>
              {/* Health Icon at top left */}
              <button
                onClick={handleCloseHealthModal}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img
                  src="/assets/All Icon Used/material-symbols-light_health-and-safety.png"
                  alt="Health icon"
                  className="w-10 h-10 object-contain"
                />
              </button>

              {/* Top Section */}
              <div className="pt-4 max-w-[85%] min-h-[21rem]">
                <h2 className="text-3xl font-normal text-black mb-3 leading-none">
                  {recommendation.title}
                </h2>
                <div className="space-y-3 text-gray-500 text-base leading-snug pr-2">
                  {recommendation.health?.map((paragraph, index) => (
                    <div key={index}>
                      <span className="font-bold">{paragraph.label}:</span>{" "}
                      <span>{paragraph.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationPopup;
