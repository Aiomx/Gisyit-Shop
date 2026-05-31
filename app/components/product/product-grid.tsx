import { cn } from "~/lib/utils";
import type { Product } from "~/lib/supabase/types";
import { ProductCard } from "./product-card";

interface ProductGridProps {
    products: Product[];
    className?: string;
    emptyMessage?: string;
}

/**
 * ProductGrid component for displaying products in a responsive grid layout
 * Requirements 7.2: Responsive grid layout for product cards
 */
export function ProductGrid({
    products,
    className,
    emptyMessage = "暂无商品",
}: ProductGridProps) {
    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <span className="text-4xl mb-4">🔍</span>
                <p className="text-lg">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "grid gap-4 sm:gap-6",
                "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
                className
            )}
        >
            {products.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
    );
}
