import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive-foreground aria-invalid:ring-2 aria-invalid:ring-destructive-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-(--button-primary-background) text-(--button-primary-foreground) hover:bg-(--button-primary-background-hover) active:bg-(--button-primary-background-active)",
        outline:
          "border-control-border bg-control hover:border-control-border-hover hover:bg-control-hover active:bg-control-active aria-expanded:bg-control-active aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent active:bg-control-active aria-expanded:bg-accent",
        ghost:
          "hover:bg-control-hover hover:text-foreground active:bg-control-active aria-expanded:bg-control-active aria-expanded:text-foreground",
        destructive:
          "bg-destructive-foreground text-primary-foreground hover:bg-(--button-destructive-background-hover) active:bg-(--button-destructive-background-active) focus-visible:border-destructive-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control gap-1.5 px-2.5",
        sm: "h-control-sm gap-1 rounded-sm px-2.5 text-xs",
        lg: "h-control-lg gap-1.5 px-3",
        icon: "size-control",
        "icon-sm": "size-control-sm rounded-sm",
        "icon-lg": "size-control-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
