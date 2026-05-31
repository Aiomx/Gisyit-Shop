import { Link } from "react-router";
import { Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { CartItemWithProduct } from "~/lib/cart/types";
import { TypeBadge, getProductTypeCategory } from "~/components/product/type-badge";
import { QuantityControl } from "./quantity-control";

interface CartItemProps {
    item: CartItemWithProduct;
    onQuantityChange?: (itemId: string, quantity: number) => void;
    onRemove?: (itemId: string) => void;
    disabled?: boolean;
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
function getPrimaryImage(item: CartItemWithProduct): string | undefined {
    const images = item.product?.images;
    if (!images || images.length === 0) {
        return undefined;
    }
    const primary = images.find((img) => img.is_primary);
    return primary?.image_url || images[0]?.image_url;
}

/**
 * Format spec combination for display
 */
function formatSpecs(specCombination?: Record<string, string>): string {
    if (!specCombination || Object.keys(specCombination).length === 0) {
        return "";
    }
    return Object.values(specCombination).join(" / ");
}

/**
 * CartItem component for displaying a single item in the cart
 * Requirements 4.2: Display item's name, quantity, snapshot price, and subtotal
 */
export function CartItem({
    item,
    onQuantityChange,
    onRemove,
    disabled = false,
    className,
}: CartItemProps) {
    const imageUrl = getPrimaryImage(item);
    const specs = formatSpecs(item.spec_combination);
    const subtotal = item.quantity * item.snapshot_price;
    const typeCategory = item.product
        ? getProductTypeCategory(item.product.product_type)
        : "digital";

    const handleQuantityChange = (newQuantity: number) => {
        onQuantityChange?.(item.id, newQuantity);
    };

    const handleRemove = () => {
        onRemove?.(item.id);
    };

    // Use slug for URL if available, fallback to product_id for backward compatibility
    const productUrl = `/product/${item.product?.slug || item.product_id}`;

    return (
        <div
            className={cn(
                "flex gap-4 p-4 bg-bg-secondary rounded-lg",
                className
            )}
        >
            {/* Product Image */}
            <Link
                to={productUrl}
                className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-bg-tertiary"
            >
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={item.product?.name || "商品图片"}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <span className="text-2xl">📦</span>
                    </div>
                )}
            </Link>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        {/* Product Name */}
                        <Link
                            to={productUrl}
                            className="font-medium text-text-primary hover:text-accent transition-colors line-clamp-2"
                        >
                            {item.product?.name || "未知商品"}
                        </Link>

                        {/* Specs */}
                        {specs && (
                            <p className="text-sm text-text-muted mt-0.5">
                                规格：{specs}
                            </p>
                        )}

                        {/* Type Badge */}
                        <div className="mt-2">
                            <TypeBadge type={typeCategory} />
                        </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemove}
                        disabled={disabled}
                        className="shrink-0 text-text-muted hover:text-error"
                        aria-label="删除商品"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Price and Quantity */}
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                        {/* Unit Price */}
                        <span className="text-sm text-text-muted">
                            {formatPrice(item.snapshot_price, item.snapshot_currency)}
                        </span>

                        {/* Quantity Control */}
                        <QuantityControl
                            value={item.quantity}
                            onChange={handleQuantityChange}
                            disabled={disabled}
                            min={1}
                            max={99}
                        />
                    </div>

                    {/* Subtotal */}
                    <span className="font-semibold text-accent">
                        {formatPrice(subtotal, item.snapshot_currency)}
                    </span>
                </div>
            </div>
        </div>
    );
}
