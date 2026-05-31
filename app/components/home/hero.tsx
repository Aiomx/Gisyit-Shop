import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { Product } from "~/lib/supabase/types";
import { TypeBadge, getProductTypeCategory } from "~/components/product";
import { ChevronRight } from "lucide-react";

interface HeroProps {
    featuredProduct?: Product;
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
 * Hero component for homepage featured product display
 * Requirements 1.1: Display Hero section with featured products
 */
export function Hero({ featuredProduct, className }: HeroProps) {
    if (!featuredProduct) {
        return (
            <section
                className={cn(
                    "relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 to-bg-secondary",
                    "min-h-[300px] md:min-h-[400px] lg:min-h-[500px]",
                    "flex items-center justify-center",
                    className
                )}
            >
                <div className="text-center p-8">
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
                        欢迎来到 Store
                    </h1>
                    <p className="text-lg text-text-secondary mb-6">
                        发现精选应用、游戏和更多优质商品
                    </p>
                    <Button asChild size="lg">
                        <Link to="/apps">开始探索</Link>
                    </Button>
                </div>
            </section>
        );
    }

    const imageUrl = getPrimaryImage(featuredProduct);
    const price = getLowestPrice(featuredProduct);
    const typeCategory = getProductTypeCategory(featuredProduct.product_type);

    return (
        <section
            className={cn(
                "relative overflow-hidden rounded-2xl",
                "min-h-[300px] md:min-h-[400px] lg:min-h-[500px]",
                className
            )}
        >
            {/* Background Image */}
            <div className="absolute inset-0">
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={featuredProduct.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg-secondary" />
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col justify-end p-6 md:p-8 lg:p-12">
                <div className="max-w-2xl">
                    {/* Type Badge */}
                    <div className="mb-4">
                        <TypeBadge type={typeCategory} />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary mb-2">
                        {featuredProduct.name}
                    </h1>

                    {/* Subtitle */}
                    {featuredProduct.subtitle && (
                        <p className="text-lg text-text-secondary mb-4 line-clamp-2">
                            {featuredProduct.subtitle}
                        </p>
                    )}

                    {/* Price and CTA */}
                    <div className="flex items-center gap-4 flex-wrap">
                        {price && (
                            <span className="text-2xl font-bold text-accent">
                                {formatPrice(price.amount, price.currency)}
                            </span>
                        )}
                        <Button asChild size="lg" className="group">
                            <Link to={`/product/${featuredProduct.slug || featuredProduct.id}`}>
                                查看详情
                                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
