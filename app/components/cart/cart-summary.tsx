import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { CartItemWithProduct } from "~/lib/cart/types";
import { getProductTypeCategory } from "~/components/product/type-badge";

interface CartSummaryProps {
    items: CartItemWithProduct[];
    onCheckout?: () => void;
    isCheckoutDisabled?: boolean;
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
 * Calculate cart totals
 */
function calculateCartTotals(items: CartItemWithProduct[]) {
    const subtotal = items.reduce(
        (sum, item) => sum + item.quantity * item.snapshot_price,
        0
    );

    // Check if cart has physical items (for shipping calculation)
    const hasPhysicalItems = items.some((item) => {
        if (!item.product) return false;
        const category = getProductTypeCategory(item.product.product_type);
        return category === "physical";
    });

    // Get primary currency (assume all items use same currency)
    const currency = items[0]?.snapshot_currency || "CNY";

    return {
        subtotal,
        hasPhysicalItems,
        currency,
        total: subtotal, // Shipping calculated separately
    };
}

/**
 * CartSummary component for displaying cart totals
 * Requirements 4.2: Display subtotal and total
 */
export function CartSummary({
    items,
    onCheckout,
    isCheckoutDisabled = false,
    className,
}: CartSummaryProps) {
    const { subtotal, hasPhysicalItems, currency, total } = calculateCartTotals(items);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div
            className={cn(
                "rounded-lg border border-border bg-bg-secondary p-6",
                className
            )}
        >
            <h2 className="text-lg font-semibold text-text-primary mb-4">
                订单摘要
            </h2>

            <div className="space-y-3">
                {/* Item count */}
                <div className="flex justify-between text-sm">
                    <span className="text-text-muted">
                        商品数量
                    </span>
                    <span className="text-text-primary">
                        {itemCount} 件
                    </span>
                </div>

                {/* Subtotal */}
                <div className="flex justify-between text-sm">
                    <span className="text-text-muted">
                        小计
                    </span>
                    <span className="text-text-primary">
                        {formatPrice(subtotal, currency)}
                    </span>
                </div>

                {/* Shipping (for physical items) */}
                {hasPhysicalItems && (
                    <div className="flex justify-between text-sm">
                        <span className="text-text-muted">
                            运费
                        </span>
                        <span className="text-text-muted">
                            待计算
                        </span>
                    </div>
                )}

                {/* Divider */}
                <div className="border-t border-border my-4" />

                {/* Total */}
                <div className="flex justify-between">
                    <span className="text-base font-medium text-text-primary">
                        合计
                    </span>
                    <span className="text-lg font-semibold text-accent">
                        {formatPrice(total, currency)}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 space-y-3">
                <Button
                    className="w-full"
                    size="lg"
                    onClick={onCheckout}
                    disabled={isCheckoutDisabled || items.length === 0}
                >
                    去结算
                </Button>
                <Button
                    variant="outline"
                    className="w-full"
                    asChild
                >
                    <Link to="/">继续购物</Link>
                </Button>
            </div>
        </div>
    );
}
