import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { variant?: "default" | "minimal" }
>(({ className, type, variant = "default", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          variant === "default" &&
            "flex h-10 w-full rounded-md border border-input px-5 py-2 text-base text-foreground placeholder:text-foreground/40 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          variant === "minimal" &&
            "flex h-10 w-full rounded-md bg-transparent border-0 outline-none px-2 text-base placeholder:text-muted-foreground focus:border-0 focus:ring-0",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
