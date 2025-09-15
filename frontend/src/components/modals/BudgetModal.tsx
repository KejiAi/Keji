import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface BudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (budget: string) => void;
}

const BudgetModal = ({ open, onOpenChange, onSubmit }: BudgetModalProps) => {
  const [customAmount, setCustomAmount] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const presetAmounts = ["200", "500", "1000", "1500", "2000", "5000"];

  const handlePresetClick = (amount: string) => {
    setSelectedPreset(amount);
    setCustomAmount(amount);
  };

  const handleSubmit = () => {
    const amount = customAmount || selectedPreset;
    if (amount) {
      onSubmit(`My budget is ₦${amount}`);
      setCustomAmount("");
      setSelectedPreset(null);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setCustomAmount("");
    setSelectedPreset(null);
    onOpenChange(false);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-end justify-center">
        {/* Modal Popup */}
        <div className="bg-white rounded-t-[2rem] md:rounded-2xl shadow-lg w-full max-h-[80vh] min-h-[67vh] overflow-y-auto 
                        max-w-md md:max-w-2xl lg:max-w-3xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-7 top-4 h-8 w-8"
              onClick={handleClose}
            >
              <img
                src="assets/All Icon Used/material-symbols_close-rounded.png"
                alt="close"
                className="w-6 h-6"
              />
            </Button>
            <h1 className="text-3xl font-funnelSans font-semibold text-center text-foreground mt-12 mb-4">
              Enter your budget
            </h1>
          </div>
      
          {/* Content */}
          <div className="px-6 pb-6 space-y-6">
            {/* Custom Input */}
            <div className="relative">
              <div className="h-18 flex items-center mx-3 px-3 py-3 bg-background rounded-[2rem] border border-border focus-within:border-black">
                <span className="scale-x-75 items-center pl-1 text-5xl font-medium font-funnelSans text-foreground mr-2">₦</span>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPreset(null);
                  }}
                  placeholder="2000"
                  className="flex-1 h-14 rounded-[1rem] bg-white/80 py-5 border-none text-3xl font-medium placeholder:text-3xl placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-center pl-5 pr-10"
                />
              </div>
            </div>
      
            {/* Preset Amounts */}
            <div className="grid grid-cols-3 gap-2 w-72 mx-auto md:w-full md:max-w-lg">
              {presetAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant={selectedPreset === amount ? "default" : "outline"}
                  className={`h-16 min-w-[80px] rounded-2xl text-lg font-medium transition-all border-2 ${
                    selectedPreset === amount
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 border-border text-foreground hover:bg-muted/50"
                  }`}
                  onClick={() => handlePresetClick(amount)}
                >
                  ₦{amount}
                </Button>
              ))}
            </div>
      
            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!customAmount && !selectedPreset}
              className="w-full h-16 bg-budget-red hover:bg-budget-red/90 text-white text-lg font-semibold rounded-full"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
      
      )}
    </>
  );
};

export default BudgetModal;