import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface CartIconProps {
    itemCount?: number;
    className?: string;
}

/**
 * CartIcon component for displaying cart icon with item count badge
 * Requirements 4.1: Display cart item count badge
 */
export function CartIcon({ itemCount = 0, className }: CartIconProps) {
    return (
        <Link to="/cart" className={cn("relative", className)}>
            <Button variant="ghost" size="icon" aria-label="购物车">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
                        {itemCount > 99 ? "99+" : itemCount}
                    </span>
                )}
            </Button>
        </Link>
    );
}
