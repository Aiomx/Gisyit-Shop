/**
 * CartPage Component
 *
 * Full cart page layout with items list and summary.
 * Displays type indicators for mixed products.
 *
 * Requirements: 4.2, 4.5
 */

import { CartItem } from "./cart-item";
import { CartEmpty } from "./cart-empty";
import { CartSummary } from "./cart-summary";
import type { CartItemWithProduct } from "~/lib/cart/types";

interface CartPageProps {
    items: CartItemWithProduct[];
    itemCount: number;
    onQuantityChange: (itemId: string, quantity: number) => void;
    onRemove: (itemId: string) => void;
    onCheckout: () => void;
    isLoading?: boolean;
    error?: { code: string; message: string } | null;
}

/**
 * CartPage component for displaying the full cart page
 * Requirements 4.2: Full cart page layout with items list and summary
 * Requirements 4.5: Display type indicators for mixed products
 */
export function CartPage({
    items,
    itemCount,
    onQuantityChange,
    onRemove,
    onCheckout,
    isLoading = false,
    error = null,
}: CartPageProps) {
    // Show empty cart state
    if (items.length === 0) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold text-text-primary mb-6">购物车</h1>
                <CartEmpty />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-text-primary">
                    购物车
                    <span className="ml-2 text-base font-normal text-text-muted">
                        ({itemCount} 件商品)
                    </span>
                </h1>
            </div>

            {/* Action feedback */}
            {error && (
                <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {error.message}
                </div>
            )}

            {/* Cart Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cart Items List */}
                <div className="lg:col-span-2 space-y-4">
                    {items.map((item) => (
                        <CartItem
                            key={item.id}
                            item={item}
                            onQuantityChange={onQuantityChange}
                            onRemove={onRemove}
                            disabled={isLoading}
                        />
                    ))}
                </div>

                {/* Cart Summary */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <CartSummary
                            items={items}
                            onCheckout={onCheckout}
                            isCheckoutDisabled={isLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
