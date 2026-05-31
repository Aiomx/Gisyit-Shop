/**
 * Embedded Checkout Page Component
 *
 * Displays order summary with embedded Stripe checkout.
 * Supports CNY and other currencies.
 *
 * Requirements: 5.2, 5.6
 */

import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { CartItemWithProduct } from "~/lib/cart/types";
import type {
    CheckoutValidationResult,
    InventoryValidationItem,
} from "~/lib/checkout/types";
import { getProductTypeCategory, TypeBadge } from "~/components/product/type-badge";
import { EmbeddedCheckoutForm } from "./embedded-checkout";

interface CheckoutEmbeddedPageProps {
    cart: {
        id: string;
        items: CartItemWithProduct[];
    } | null;
    validation: CheckoutValidationResult | null;
    error: {
        code: string;
        message: string;
    } | null;
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
 * Checkout item row component
 */
function CheckoutItem({
    item,
    validationItem,
}: {
    item: CartItemWithProduct;
    validationItem?: InventoryValidationItem;
}) {
    const hasError = validationItem && !validationItem.isAvailable;
    const productType = item.product?.product_type;
    const typeCategory = productType ? getProductTypeCategory(productType) : null;

    return (
        <div
            className={cn(
                "flex gap-4 py-4 border-b border-border last:border-b-0",
                hasError && "bg-destructive/5 -mx-4 px-4 rounded"
            )}
        >
            {/* Product Image */}
            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-bg-tertiary">
                {item.product?.images?.[0]?.image_url ? (
                    <img
                        src={item.product.images[0].image_url}
                        alt={item.product.images[0].alt_text || item.product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <svg
                            className="w-8 h-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h3 className="font-medium text-text-primary truncate">
                            {item.product?.name ?? "未知商品"}
                        </h3>
                        {item.spec_combination && Object.keys(item.spec_combination).length > 0 && (
                            <p className="text-sm text-text-muted mt-0.5">
                                {Object.entries(item.spec_combination)
                                    .map(([key, value]) => `${key}: ${value}`)
                                    .join(" / ")}
                            </p>
                        )}
                        {typeCategory && (
                            <div className="mt-1">
                                <TypeBadge type={typeCategory} />
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="font-medium text-text-primary">
                            {formatPrice(item.snapshot_price * item.quantity, item.snapshot_currency)}
                        </p>
                        <p className="text-sm text-text-muted">
                            {formatPrice(item.snapshot_price, item.snapshot_currency)} × {item.quantity}
                        </p>
                    </div>
                </div>

                {/* Validation Error */}
                {hasError && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                        <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <span>{validationItem.errorMessage}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Validation errors display component
 */
function ValidationErrors({
    errors,
    validationItems,
}: {
    errors: string[];
    validationItems?: InventoryValidationItem[];
}) {
    if (errors.length === 0) return null;

    const inventoryErrors = validationItems?.filter(
        (item) => !item.isAvailable && item.errorMessage?.includes("库存不足")
    ) || [];
    const unavailableErrors = validationItems?.filter(
        (item) => !item.isAvailable && (item.errorMessage?.includes("下架") || item.errorMessage?.includes("不存在"))
    ) || [];

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                    <svg
                        className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <div className="flex-1">
                        <h4 className="font-medium text-destructive">无法完成结算</h4>
                        <p className="mt-1 text-sm text-destructive/80">
                            请解决以下问题后再继续结算
                        </p>
                    </div>
                </div>
            </div>

            {inventoryErrors.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                    <h5 className="font-medium text-amber-700 dark:text-amber-500 mb-2">
                        库存不足
                    </h5>
                    <ul className="space-y-1 text-sm">
                        {inventoryErrors.map((item, index) => (
                            <li key={index} className="text-amber-600 dark:text-amber-400">
                                {item.productName}: {item.errorMessage}
                            </li>
                        ))}
                    </ul>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 border-amber-500/50 text-amber-700"
                        asChild
                    >
                        <Link to="/cart">返回购物车修改</Link>
                    </Button>
                </div>
            )}

            {unavailableErrors.length > 0 && (
                <div className="rounded-lg border border-gray-500/50 bg-gray-500/10 p-4">
                    <h5 className="font-medium text-gray-700 dark:text-gray-400 mb-2">
                        商品不可用
                    </h5>
                    <ul className="space-y-1 text-sm">
                        {unavailableErrors.map((item, index) => (
                            <li key={index} className="text-gray-600 dark:text-gray-400">
                                {item.productName}: {item.errorMessage}
                            </li>
                        ))}
                    </ul>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 border-gray-500/50 text-gray-700"
                        asChild
                    >
                        <Link to="/cart">返回购物车移除</Link>
                    </Button>
                </div>
            )}
        </div>
    );
}

/**
 * CheckoutEmbeddedPage component
 */
export function CheckoutEmbeddedPage({ cart, validation, error }: CheckoutEmbeddedPageProps) {
    const [checkoutError, setCheckoutError] = useState<{ code: string; message: string } | null>(null);
    const [showCheckout, setShowCheckout] = useState(false);

    // Error state - no cart or general error
    if (error || !cart) {
        return (
            <div className="max-w-2xl mx-auto py-8">
                <h1 className="text-2xl font-bold text-text-primary mb-6">结算</h1>
                <Card>
                    <CardContent className="py-12 text-center">
                        <svg
                            className="w-16 h-16 mx-auto text-text-muted mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            />
                        </svg>
                        <h2 className="text-lg font-medium text-text-primary mb-2">
                            {error?.message || "购物车为空"}
                        </h2>
                        <p className="text-text-muted mb-6">请先添加商品到购物车</p>
                        <Button asChild>
                            <Link to="/">浏览商品</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const items = cart.items;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const hasValidationErrors = validation && !validation.valid;

    // Build validation item map
    const validationItemMap = new Map<string, InventoryValidationItem>();
    if (validation?.inventoryValidation.items) {
        for (const item of validation.inventoryValidation.items) {
            validationItemMap.set(item.cartItemId, item);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-2xl font-bold text-text-primary mb-6">确认订单</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Items */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Validation Errors */}
                    {hasValidationErrors && validation && (
                        <ValidationErrors
                            errors={validation.errors}
                            validationItems={validation.inventoryValidation.items}
                        />
                    )}

                    {/* Checkout Error */}
                    {checkoutError && (
                        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <div className="flex items-start gap-3">
                                <svg
                                    className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <div>
                                    <h4 className="font-medium text-destructive">支付失败</h4>
                                    <p className="mt-1 text-sm text-destructive/80">
                                        {checkoutError.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items List */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                商品清单 ({itemCount} 件)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-border">
                                {items.map((item) => (
                                    <CheckoutItem
                                        key={item.id}
                                        item={item}
                                        validationItem={validationItemMap.get(item.id)}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Embedded Checkout */}
                    {showCheckout && !hasValidationErrors && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">支付信息</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <EmbeddedCheckoutForm
                                    onError={(err) => setCheckoutError(err)}
                                />
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-4">
                        <CardHeader>
                            <CardTitle className="text-lg">订单摘要</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Subtotal */}
                            <div className="flex justify-between text-sm">
                                <span className="text-text-muted">商品小计</span>
                                <span className="text-text-primary">
                                    {formatPrice(
                                        validation?.cartTotal ?? 0,
                                        validation?.currency ?? "CNY"
                                    )}
                                </span>
                            </div>

                            {/* Shipping note */}
                            {items.some(
                                (item) =>
                                    item.product &&
                                    getProductTypeCategory(item.product.product_type) === "physical"
                            ) && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-text-muted">运费</span>
                                        <span className="text-text-muted">待计算</span>
                                    </div>
                                )}

                            <div className="border-t border-border pt-4">
                                <div className="flex justify-between">
                                    <span className="font-medium text-text-primary">合计</span>
                                    <span className="text-lg font-semibold text-accent">
                                        {formatPrice(
                                            validation?.cartTotal ?? 0,
                                            validation?.currency ?? "CNY"
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Checkout Button */}
                            {!showCheckout ? (
                                <Button
                                    onClick={() => setShowCheckout(true)}
                                    className="w-full"
                                    size="lg"
                                    disabled={hasValidationErrors || false}
                                >
                                    去支付
                                </Button>
                            ) : (
                                <p className="text-sm text-text-muted text-center">
                                    请在左侧完成支付
                                </p>
                            )}

                            {/* Back to cart */}
                            <Button variant="outline" className="w-full" asChild>
                                <Link to="/cart">返回购物车</Link>
                            </Button>

                            {/* Security note */}
                            <p className="text-xs text-text-muted text-center pt-2">
                                <svg
                                    className="w-3 h-3 inline-block mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                    />
                                </svg>
                                安全支付由 Stripe 提供
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
