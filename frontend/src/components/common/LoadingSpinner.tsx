import { motion } from "framer-motion";
import { ChefHat } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  showTips?: boolean;
}

const LoadingSpinner = ({ 
  message = "Loading...", 
  showTips = false 
}: LoadingSpinnerProps) => {
  const tips = [
    "🍽️ Keji can suggest meals based on your budget",
    "⚡ Get quick meal ideas for busy schedules", 
    "🥘 Find recipes with ingredients you already have",
    "💰 Discover budget-friendly meal options",
    "🤖 AI-powered recommendations just for you"
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        {/* Animated Logo */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 mx-auto mb-6"
        >
          <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
        </motion.div>

        {/* Loading Message */}
        <motion.h2 
          className="text-2xl font-semibold text-foreground mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.h2>

        {/* Loading Dots */}
        <motion.div 
          className="flex space-x-2 justify-center mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-primary rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>

        {/* Tips Section */}
        {showTips && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="max-w-md mx-auto"
          >
            <p className="text-sm text-muted-foreground mb-4">
              While you wait, here's what Keji can do for you:
            </p>
            <div className="space-y-2">
              {tips.map((tip, index) => (
                <motion.p
                  key={index}
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                >
                  {tip}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default LoadingSpinner;
