import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { Product } from "~/lib/supabase/types";
import { TypeBadge, getProductTypeCategory } from "~/components/product";

interface TodayCardProps {
    product: Product;
    label?: string;
    className?: string;
}

/**
 * Get primary image URL from product
 */
function getPrimaryImage(product: Product): string | undefined {
    if (!product.images || product.images.length === 0) {
        return undefined;
    }
    const primary = product.images.find((img) => img.is_primary);
    return primary?.image_url || product.images[0]?.image_url;
}

/**
 * Format price with currency
 */
function formatPrice(amount: number, currency: string = "CNY"): string {
    if (currency === "CNY") {
        return `¥${amount.toFixed(2)}`;
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
}

/**
 * Get lowest active price from product
 */
function getLowestPrice(product: Product): { amount: number; currency: string } | undefined {
    if (!product.prices || product.prices.length === 0) {
        return undefined;
    }
    const activePrices = product.prices.filter((p) => p.is_active);
    if (activePrices.length === 0) {
        return undefined;
    }
    const lowest = activePrices.reduce((min, p) =>
        p.price_amount < min.price_amount ? p : min
    );
    return { amount: lowest.price_amount, currency: lowest.currency };
}

/**
 * TodayCard component for editorial/featured content display
 * Requirements 1.1: Display Today Cards for featured content
 */
export function TodayCard({ product, label = "今日推荐", className }: TodayCardProps) {
    const imageUrl = getPrimaryImage(product);
    const price = getLowestPrice(product);
    const typeCategory = getProductTypeCategory(product.product_type);

    // Use slug for URL if available, fallback to id for backward compatibility
    const productUrl = `/product/${product.slug || product.id}`;

    return (
        <Link to={productUrl} className="block group">
            <div
                className={cn(
                    "rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02]",
                    "relative",
                    className
                )}
            >
                {/* Image Section - 无边框无间隙 */}
                <div className="aspect-[4/3] relative overflow-hidden bg-bg-tertiary rounded-xl">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-bg-tertiary">
                            <span className="text-6xl">✨</span>
                        </div>
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Content Overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-5">
                        {/* Label */}
                        <span className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">
                            {label}
                        </span>

                        {/* Title */}
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1 line-clamp-2 group-hover:text-accent transition-colors">
                            {product.name}
                        </h3>

                        {/* Subtitle */}
                        {product.subtitle && (
                            <p className="text-sm text-white/80 line-clamp-2 mb-3">
                                {product.subtitle}
                            </p>
                        )}

                        {/* Footer: Type Badge and Price */}
                        <div className="flex items-center justify-between">
                            <TypeBadge type={typeCategory} />
                            {price && (
                                <span className="text-lg font-semibold text-accent">
                                    {formatPrice(price.amount, price.currency)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}

interface TodayCardGridProps {
    products: Product[];
    className?: string;
}

/**
 * Grid layout for TodayCards
 */
export function TodayCardGrid({ products, className }: TodayCardGridProps) {
    const labels = ["今日推荐", "编辑精选", "热门新品", "限时优惠"];

    if (products.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "grid gap-4 md:gap-6",
                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                className
            )}
        >
            {products.slice(0, 6).map((product, index) => (
                <TodayCard
                    key={product.id}
                    product={product}
                    label={labels[index % labels.length]}
                />
            ))}
        </div>
    );
}
