import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface CartEmptyProps {
    className?: string;
}

/**
 * CartEmpty component for displaying empty cart state
 * Requirements 4.6: Empty state with navigation to browse products
 */
export function CartEmpty({ className }: CartEmptyProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4",
                className
            )}
        >
            {/* Icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-secondary mb-6">
                <ShoppingCart className="h-10 w-10 text-text-muted" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-semibold text-text-primary mb-2">
                购物车是空的
            </h2>

            {/* Description */}
            <p className="text-text-muted text-center max-w-sm mb-8">
                您的购物车中还没有商品，快去发现您喜欢的商品吧！
            </p>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild>
                    <Link to="/">浏览首页</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link to="/apps">探索应用</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link to="/games">探索游戏</Link>
                </Button>
            </div>
        </div>
    );
}
