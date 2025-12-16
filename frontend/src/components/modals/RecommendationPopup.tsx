import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RecommendationPopupProps {
  recommendation: {
    title: string;
    content: string;
    health?: Array<{ label: string; description: string }>;
  } | null;
  onClose: () => void;
  onAccept: (acceptanceMessage: string) => void;
  onReject: () => void;
}

const RecommendationPopup = ({ recommendation, onClose, onAccept, onReject }: RecommendationPopupProps) => {
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

  const handleAccept = () => {
    // Generate acceptance message and let parent handle WebSocket communication
    const acceptanceMessage = `Thanks, I'm eating ${recommendation.title}`;
    onAccept(acceptanceMessage);
  };

  return (
    <>
      {/* Main backdrop */}
      <div 
        className="fixed inset-0 z-30 bg-black/50"
        onClick={handleBackdropClick}
      />

      {/* Recommendation Card Container */}
      <div 
        className={`fixed inset-0 z-50 flex flex-col justify-start items-center pt-16 px-2 transition-transform duration-300 pointer-events-none ${
          showHealthModal ? 'translate-x-[86%]' : 'translate-x-0'
        }`}
      >
        <div className="w-full max-w-md mx-auto pointer-events-auto">
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
                  onClick={onReject}
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


      {/* Health Modal */}
      {isHealthModalVisible && recommendation.health && (
        <div className="fixed inset-0 z-40 flex justify-center items-start pt-16 px-2 pointer-events-none">
          <div className="w-full max-w-md mx-auto pointer-events-auto">
            {/* Modal */}
            <div className="relative bg-background px-4 pb-4 rounded-2xl pt-4" onClick={(e) => e.stopPropagation()}>
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
              <div className="pt-4 max-w-[85%] h-[20rem]">
                <h2 className="text-3xl font-normal text-black mb-3 leading-none">
                  {recommendation.title}
                </h2>
                <div className="space-y-3 text-gray-500 text-base leading-tight pr-2">
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
    </>
  );
};

export default RecommendationPopup;
