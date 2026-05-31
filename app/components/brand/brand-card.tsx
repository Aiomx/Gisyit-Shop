import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { Brand } from "~/lib/supabase/types";

interface BrandCardProps {
    brand: Brand;
    productCount?: number;
    onClick?: () => void;
    className?: string;
}

/**
 * BrandCard component for displaying brand in grid/list views
 * Requirements: 3.1, 3.2
 * - Display brand logo, name, and product count
 * - Add hover effects and click handler
 */
export function BrandCard({ brand, productCount, onClick, className }: BrandCardProps) {
    const content = (
        <div
            className={cn(
                "rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] cursor-pointer",
                className
            )}
            onClick={onClick}
        >
            {/* Brand Logo - 无边框无间隙 */}
            <div className="aspect-square relative overflow-hidden bg-bg-tertiary rounded-xl flex items-center justify-center p-6">
                {brand.logo_url ? (
                    <img
                        src={brand.logo_url}
                        alt={brand.name}
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-5xl font-bold text-text-muted">
                            {brand.name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}
            </div>

            {/* Brand Info */}
            <div className="pt-3 text-center space-y-1">
                {/* Brand Name */}
                <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
                    {brand.name}
                </h3>

                {/* Product Count */}
                {productCount !== undefined && (
                    <p className="text-sm text-text-muted">
                        {productCount} 个商品
                    </p>
                )}
            </div>
        </div>
    );

    // If onClick is provided, don't wrap in Link
    if (onClick) {
        return <div className="group">{content}</div>;
    }

    // Default: wrap in Link to brand detail page
    return (
        <Link to={`/brands/${brand.slug}`} className="block group">
            {content}
        </Link>
    );
}
