import { cn } from "~/lib/utils";
import type { ProductPrice as ProductPriceType } from "~/lib/supabase/types";

interface ProductPriceProps {
    price: ProductPriceType;
    originalPrice?: ProductPriceType;
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Format price with currency
 */
export function formatPrice(amount: number, currency: string = "CNY"): string {
    if (currency === "CNY") {
        return `¥${amount.toFixed(2)}`;
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
}

/**
 * Get the lowest active price from a list of prices
 */
export function getLowestPrice(
    prices: ProductPriceType[] | undefined
): ProductPriceType | undefined {
    if (!prices || prices.length === 0) {
        return undefined;
    }
    const activePrices = prices.filter((p) => p.is_active);
    if (activePrices.length === 0) {
        return undefined;
    }
    return activePrices.reduce((min, p) =>
        p.price_amount < min.price_amount ? p : min
    );
}

/**
 * Get price by spec combination
 */
export function getPriceBySpecs(
    prices: ProductPriceType[] | undefined,
    specCombination: Record<string, string>
): ProductPriceType | undefined {
    if (!prices || prices.length === 0) {
        return undefined;
    }

    const activePrices = prices.filter((p) => p.is_active);

    // Find exact match for spec combination
    const exactMatch = activePrices.find((p) => {
        if (!p.spec_combination) {
            return Object.keys(specCombination).length === 0;
        }
        const priceSpecs = p.spec_combination;
        const specKeys = Object.keys(specCombination);
        const priceKeys = Object.keys(priceSpecs);

        if (specKeys.length !== priceKeys.length) {
            return false;
        }

        return specKeys.every((key) => priceSpecs[key] === specCombination[key]);
    });

    return exactMatch || getLowestPrice(activePrices);
}

const sizeClasses = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
};

/**
 * ProductPrice component for displaying product price with currency formatting
 * Requirements 2.1: Display product price
 */
export function ProductPrice({
    price,
    originalPrice,
    size = "md",
    className,
}: ProductPriceProps) {
    const hasDiscount =
        originalPrice && originalPrice.price_amount > price.price_amount;

    return (
        <div className={cn("flex items-baseline gap-2", className)}>
            <span
                className={cn(
                    "font-bold text-accent",
                    sizeClasses[size]
                )}
            >
                {formatPrice(price.price_amount, price.currency)}
            </span>

            {hasDiscount && (
                <span className="text-sm text-text-muted line-through">
                    {formatPrice(originalPrice.price_amount, originalPrice.currency)}
                </span>
            )}
        </div>
    );
}

/**
 * Simple price display without discount
 */
export function SimplePriceDisplay({
    amount,
    currency = "CNY",
    size = "md",
    className,
}: {
    amount: number;
    currency?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    return (
        <span
            className={cn(
                "font-bold text-accent",
                sizeClasses[size],
                className
            )}
        >
            {formatPrice(amount, currency)}
        </span>
    );
}
