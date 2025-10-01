import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface IngredientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => void;
}

const IngredientModal = ({ open, onOpenChange, onSubmit }: IngredientModalProps) => {
  const [customIngredient, setCustomIngredient] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  const presetIngredients = ["Rice", "Garri", "Spaghetti", "Plantain", "Fish", "Beans", "Noodles"];

  const handlePresetClick = (ingredient: string) => {
    if (!selectedIngredients.includes(ingredient)) {
      setSelectedIngredients(prev => [...prev, ingredient]);
    }
  };

  const handleRemoveIngredient = (ingredient: string) => {
    setSelectedIngredients(prev => prev.filter(item => item !== ingredient));
  };

  const handleAddCustom = () => {
    if (customIngredient.trim() && !selectedIngredients.includes(customIngredient.trim())) {
      setSelectedIngredients(prev => [...prev, customIngredient.trim()]);
      setCustomIngredient("");
    }
  };

  const handleSubmit = () => {
    if (selectedIngredients.length > 0) {
      const ingredientWord = selectedIngredients.length === 1 ? "ingredient" : "ingredients";
      const message = `I have these ${ingredientWord}: ${selectedIngredients.join(", ")}. What can I cook?`;
      onSubmit(message);
      setSelectedIngredients([]);
      setCustomIngredient("");
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setSelectedIngredients([]);
    setCustomIngredient("");
    onOpenChange(false);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-background">
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Modal Content */}
          <div className="bg-white pb-6 rounded-t-[2rem] md:rounded-2xl shadow-lg 
                          w-full max-w-md md:max-w-2xl lg:max-w-3xl 
                          h-[80vh] overflow-y-auto">
            
            {/* Header */}
            <div className="px-6 pt-6 pb-4 relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4 h-8 w-8"
                onClick={handleClose}
              >
                <img src="assets/All Icon Used/material-symbols_close-rounded.png" alt="close" className="w-6 h-6" />
              </Button>
              
              <div className="text-center mt-8">
                <h1 className="text-3xl font-funnelSans font-semibold text-center text-foreground mt-12 mb-6">
                  Start with Ingredient
                </h1>
                <p className="text-lg text-muted-foreground">
                  Tell me wetin you get for kitchen, so I can help you to cook something sweet.
                </p>
              </div>
            </div>
      
            {/* Content */}
            <div className="px-6 pb-6 space-y-6 my-5 bg-muted/60 p-6 rounded-[3rem] min-h-[50vh] mx-5 flex flex-col">
              {/* Scrollable Section */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {/* Custom Input with Add Button */}
                <div className="flex items-center gap-2">
                  <Input
                    value={customIngredient}
                    onChange={(e) => setCustomIngredient(e.target.value)}
                    placeholder="Enter it here"
                    className="flex-1 h-12 rounded-full border-2 border-border focus:border-neutral-800 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustom()}
                  />
                  <Button
                    onClick={handleAddCustom}
                    size="icon"
                    className="h-12 w-12 p-0 rounded-full bg-muted"
                    disabled={!customIngredient.trim()}
                  >
                    <img src="\assets/All Icon Used/jam_plus.png" alt="add" className="w-full h-full object-contain" />
                  </Button>
                </div>
      
                {/* Preset Ingredients */}
                <div className="flex flex-wrap gap-2">
                  {presetIngredients.map((ingredient) => (
                    <Button
                      key={ingredient}
                      variant={selectedIngredients.includes(ingredient) ? "default" : "outline"}
                      className={`h-8 px-2 rounded-full text-md font-light transition-all ${
                        selectedIngredients.includes(ingredient)
                          ? "bg-ingredient-green text-ingredient-green-foreground"
                          : "bg-muted border-border text-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => handlePresetClick(ingredient)}
                    >
                      {ingredient}
                    </Button>
                  ))}
                </div>
      
                <div>
                  <hr className="border-border pt-0"/>
                </div>
      
                {/* Selected Ingredients */}
                {selectedIngredients.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-md font-medium text-muted-foreground">Selected Food Items</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedIngredients.map((ingredient) => (
                        <div
                          key={ingredient}
                          className="h-8 px-2 flex items-center gap-2 bg-ingredient-green text-ingredient-green-foreground py-1 rounded-full text-md"
                        >
                          <span>{ingredient}</span>
                          <button
                            onClick={() => handleRemoveIngredient(ingredient)}
                            className="text-primary-foreground hover:opacity-70"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
      
              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={selectedIngredients.length === 0}
                className="w-full h-16 bg-budget-red hover:bg-budget-red/90 text-white text-lg font-semibold rounded-full mt-4 mb-2"
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      )}
    </>
  );
};

export default IngredientModal;