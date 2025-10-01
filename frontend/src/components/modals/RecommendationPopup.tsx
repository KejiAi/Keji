import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/lib/utils";
import { useState } from "react";

interface RecommendationPopupProps {
  recommendation: {
    title: string;
    content: string;
    health?: string;
  } | null;
  onClose: () => void;
  onAccept: (acceptanceMessage: string) => void;
}

const RecommendationPopup = ({ recommendation, onClose, onAccept }: RecommendationPopupProps) => {
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [isHealthModalVisible, setIsHealthModalVisible] = useState(false);
  
  if (!recommendation) return null;

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
    <>
      {/* Recommendation Modal */}
      <div 
        className={`fixed inset-0 z-50 flex justify-center items-start m-2 transition-transform duration-300 ${
          showHealthModal ? 'translate-x-[88%]' : 'translate-x-0'
        }`}
      >
        {/* Wrapper that creates the top background */}
        <div className="w-full max-w-md mx-auto">
          {/* Top filler background */}
          <div className="h-24 bg-background" />

          {/* Modal */}
          <div className="relative bg-muted rounded-2xl shadow-sm p-4">
          {/* Top Section */}
          <div className="bg-white rounded-xl px-6 py-8 h-[26rem] overflow-y-auto">
            <h2 className="text-4xl font-bold text-black mb-4 leading-tight">
              {recommendation.title}
            </h2>
            <div className="text-gray-600 text-xl leading-relaxed">
              {recommendation.content}
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-6 flex justify-between">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={showHealthModal}
                className="bg-black text-white hover:bg-gray-800 border-black rounded-full px-6 h-12 text-xl font-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No
              </Button>

              <Button
                onClick={handleAccept}
                disabled={showHealthModal}
                className="bg-budget-red hover:bg-red-600 text-white rounded-full px-6 h-12 text-xl font-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                I will eat this
              </Button>
            </div>

            {/* Health Icon */}
            <div className="flex-shrink-0">
              <button 
                onClick={handleOpenHealthModal}
                disabled={!recommendation.health}
                className="w-12 h-12 flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" 
              >
                <img
                  src="/assets/All Icon Used/material-symbols-light_health-and-safety.png"
                  alt="Health icon"
                  className="w-12 h-12 object-contain"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Health Modal */}
      {isHealthModalVisible && recommendation.health && (
        <div className="fixed inset-0 z-[40] flex justify-center items-start mx-2">
          {/* Wrapper that creates the top background */}
          <div className="w-full max-w-md mx-auto">
            {/* Top filler background */}
            <div className="h-24 bg-background" />

            {/* Modal */}
            <div className="relative bg-background px-4 pb-4">
              {/* Health Icon at top left */}
              <button
                onClick={handleCloseHealthModal}
                className="top-8 left-8 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img
                  src="/assets/All Icon Used/material-symbols-light_health-and-safety.png"
                  alt="Health icon"
                  className="w-12 h-12 object-contain"
                />
              </button>

              {/* Top Section */}
              <div className="pt-4 max-w-[85%] min-h-[29rem]">
                <h2 className="text-3xl font-semibold text-black mb-3 leading-tight">
                  {recommendation.title}
                </h2>
                <div className="space-y-3 text-gray-500 text-xl leading-snug pr-2">
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