import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputVerificationProps {
  length?: 4 | 6;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const InputVerification = React.forwardRef<
  HTMLDivElement,
  InputVerificationProps
>(({ className, length = 6, value = "", onChange, onComplete, disabled, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState("");
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const actualValue = value || internalValue;

  const handleChange = (index: number, digit: string) => {
    if (disabled) return;
    
    // Only allow single digits
    if (digit.length > 1) return;
    
    const newValue = actualValue.split("");
    newValue[index] = digit;
    const result = newValue.join("").slice(0, length);
    
    if (onChange) {
      onChange(result);
    } else {
      setInternalValue(result);
    }

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete when all digits are filled
    if (result.length === length && onComplete) {
      onComplete(result);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === "Backspace" && !actualValue[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return;
    
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, length);
    
    if (onChange) {
      onChange(digits);
    } else {
      setInternalValue(digits);
    }

    // Focus the next empty input or the last input
    const nextIndex = Math.min(digits.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    if (digits.length === length && onComplete) {
      onComplete(digits);
    }
  };

  return (
    <div
      ref={ref}
      className={cn("flex gap-2", className)}
      {...props}
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={actualValue[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "h-12 w-12 text-center text-lg font-semibold",
            "rounded-xl border border-input",
            "bg-background text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200"
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
});

InputVerification.displayName = "InputVerification";

export { InputVerification };