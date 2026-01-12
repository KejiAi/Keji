import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ChatStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStyle?: string;
  onStyleUpdate: (style: string) => Promise<boolean>;
}

const chatStyles = [
  { value: "pure_english", label: "Pure English" },
  { value: "more_english", label: "80% English" }, // { value: "more_english", label: "More English (80%)" },
  // { value: "mix", label: "50-50 Mix" },
  // { value: "more_pidgin", label: "More Pidgin (80%)" },
  { value: "pure_pidgin", label: "Street Padi" }, // { value: "pure_pidgin", label: "Pure Pidgin" },
];

const ChatStyleModal = ({ isOpen, onClose, currentStyle = "pure_english", onStyleUpdate }: ChatStyleModalProps) => {
  const [selectedStyle, setSelectedStyle] = useState(currentStyle);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedStyle(currentStyle);
  }, [currentStyle, isOpen]);

  const handleSave = async () => {
    if (selectedStyle === currentStyle) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      // Use Supabase via the onStyleUpdate callback
      const success = await onStyleUpdate(selectedStyle);

      if (success) {
        toast({
          title: "Chat style updated",
          description: "Your chat style preference has been saved.",
        });
        onClose();
      } else {
        toast({
          title: "Update failed",
          description: "Could not update chat style. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Chat style update error:", error);
      toast({
        title: "Network error",
        description: "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-3xl font-semibold text-foreground">
            Choose how you want me to talk:
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          <RadioGroup value={selectedStyle} onValueChange={setSelectedStyle}>
            <div className="space-y-5">
              {chatStyles.map((style) => (
                <div key={style.value} className="flex items-center space-x-5">
                  <RadioGroupItem value={style.value} id={style.value} />
                  <Label
                    htmlFor={style.value}
                    className="text-xl font-normal cursor-pointer flex-1"
                  >
                    {style.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            onClick={handleSave}
            loading={isSaving}
            className="flex-1 bg-budget-red hover:bg-budget-red/90"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatStyleModal;
