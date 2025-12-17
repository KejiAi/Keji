import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getBackendUrl } from "@/lib/utils";
import PageContainer from "@/components/layout/PageContainer";
import Logo from "@/components/branding/Logo";
import SEO from "@/components/common/SEO";
import MobileOnlyWrapper from "@/components/common/MobileOnlyWrapper";

const Feedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getBackendUrl()}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
        }),
      });

      if (response.ok) {
        toast({
          title: "Thank You!",
          description: "Your feedback has been submitted successfully.",
        });
        setRating(0);
        setComment("");
      } else {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Unable to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMicClick = () => {
    setIsRecording(!isRecording);
    toast({
      title: isRecording ? "Recording Stopped" : "Recording Started",
      description: isRecording ? "Voice input has ended." : "Speak your feedback now.",
    });
  };

  return (
    <MobileOnlyWrapper>
      <PageContainer variant="static">
        <SEO
          title="Feedback — Keji AI"
          description="Share your feedback and help us improve Keji AI."
        />

        <div className="min-h-screen pb-6 px-4">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: 24, height: 24 }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 5 L7 12 L15 19" />
                <line x1="7" y1="12" x2="21" y2="12" />
              </svg>
            </Button>
          </div>
          <h1 className="font-funnelDisplay text-2xl font-bold text-foreground text-center mb-6">
            Feedback
          </h1>

          {/* Rating Section */}
          <Card className="mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-xl font-funnelDisplay">Rate Your Experience</CardTitle>
              <CardDescription className="font-geist">
                How would you rate Keji AI?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110 active:scale-95"
                  >
                    <Star
                      className={`h-10 w-10 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/30"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center mt-3 text-sm text-muted-foreground font-geist">
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent!"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comment Section */}
          <Card className="mb-6 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-funnelDisplay">Share Your Thoughts</CardTitle>
              <CardDescription className="font-geist">
                Tell us what you love or what we can improve
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  placeholder="Type your feedback here..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[120px] resize-none pr-12 font-geist"
                  maxLength={500}
                />
                {/* Mic Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleMicClick}
                  className={`absolute bottom-3 right-3 p-0 hover:opacity-80 transition ${
                    isRecording ? "animate-pulse" : ""
                  }`}
                >
                  <img
                    src="assets/All Icon Used/mic-HP.png"
                    alt="mic"
                    className="h-6 w-6 object-contain"
                  />
                  <span className="sr-only">Voice input</span>
                </Button>
              </div>
              <p className="text-right text-xs text-muted-foreground mt-2 font-geist">
                {comment.length}/500
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              variant="hero"
              size="xl"
              className="w-42 rounded-3xl mt-6"
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      </PageContainer>
    </MobileOnlyWrapper>
  );
};

export default Feedback;
