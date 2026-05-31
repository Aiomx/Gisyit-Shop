import { Link } from "react-router";
import { cn } from "~/lib/utils";
import type { Product } from "~/lib/supabase/types";
import { TypeBadge, getProductTypeCategory } from "./type-badge";
import { checkFreeProduct } from "~/lib/product/free-product";

interface ProductCardProps {
    product: Product;
    className?: string;
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
 * ProductCard component for displaying product in grid/list views
 * Requirements 1.6: Click navigation to product detail
 * Requirements 2.1: Display product image, name, price
 * Requirements 2.1, 2.2, 2.3, 2.4: Button text based on free product status
 */
export function ProductCard({ product, className }: ProductCardProps) {
    const imageUrl = getPrimaryImage(product);
    const price = getLowestPrice(product);
    const typeCategory = getProductTypeCategory(product.product_type);

    // Check if product is free to determine button text
    // Requirements 2.1, 2.2: Display "下载" for free products, "购买" for paid products
    const { isFree } = checkFreeProduct(product);

    // Use slug for URL if available, fallback to id for backward compatibility
    const productUrl = `/product/${product.slug || product.id}`;

    return (
        <Link to={productUrl} className="block group">
            <div
                className={cn(
                    "rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02]",
                    className
                )}
            >
                {/* Product Image - 无边框无间隙 */}
                <div className="aspect-[4/3] relative overflow-hidden bg-bg-tertiary rounded-xl">
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted bg-gradient-to-br from-bg-secondary to-bg-tertiary">
                            <span className="text-5xl">📦</span>
                        </div>
                    )}
                    {/* Type Badge - positioned at top left */}
                    <div className="absolute top-3 left-3">
                        <TypeBadge type={typeCategory} />
                    </div>
                </div>

                {/* Product Info - 紧凑布局 */}
                <div className="pt-3 space-y-1">
                    {/* Product Name */}
                    <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
                        {product.name}
                    </h3>

                    {/* Subtitle */}
                    {product.subtitle && (
                        <p className="text-sm text-text-muted line-clamp-1">
                            {product.subtitle}
                        </p>
                    )}

                    {/* Price Row */}
                    <div className="flex items-center gap-2 pt-1">
                        {isFree ? (
                            <span className="text-sm font-medium text-success">免费</span>
                        ) : price ? (
                            <span className="text-sm font-medium text-accent">
                                {formatPrice(price.amount, price.currency)}
                            </span>
                        ) : (
                            <span className="text-sm text-text-muted">价格待定</span>
                        )}

                        {/* Discount indicator - only for paid products */}
                        {!isFree && product.has_discount && (
                            <span className="text-xs text-success font-medium px-1.5 py-0.5 bg-success/10 rounded">
                                优惠
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
