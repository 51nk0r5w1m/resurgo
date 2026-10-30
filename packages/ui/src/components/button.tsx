import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ivory)] disabled:pointer-events-none disabled:opacity-50",
  {
    defaultVariants: {
      size: "default",
      variant: "primary",
    },
    variants: {
      size: {
        default: "h-11 px-5 py-2.5",
        lg: "h-12 px-6 py-3",
        sm: "h-9 px-4",
      },
      variant: {
        outline:
          "border border-[var(--color-forest)] bg-transparent text-[var(--color-forest)] hover:bg-[var(--color-sage-pale)]",
        primary:
          "bg-[var(--color-forest)] text-[var(--color-ivory)] shadow-sm hover:bg-[var(--color-forest-light)]",
        quiet: "text-[var(--color-forest)] hover:bg-[var(--color-sage-pale)]",
      },
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}

export { buttonVariants };
