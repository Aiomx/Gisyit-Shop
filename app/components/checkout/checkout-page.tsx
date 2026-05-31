/**
 * CheckoutPage Component
 *
 * Displays order summary before redirect to Stripe checkout.
 * Shows validation errors for inventory issues.
 *
 * Requirements: 5.2, 5.6
 */

import { useFetcher, Link } from "react-router";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { CartItemWithProduct } from "~/lib/cart/types";
import type {
    CheckoutValidationResult,
    CheckoutActionResult,
    InventoryValidationItem,
} from "~/lib/checkout/types";
import { getProductTypeCategory, TypeBadge } from "~/components/product/type-badge";

interface CheckoutPageProps {
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
 * Error type categorization for better UX
 */
type ValidationErrorType = "inventory" | "unavailable" | "general";

interface CategorizedError {
    type: ValidationErrorType;
    message: string;
    productName?: string;
    availableQuantity?: number;
    requestedQuantity?: number;
}

/**
 * Categorize errors for better display
 */
function categorizeErrors(
    errors: string[],
    validationItems?: InventoryValidationItem[]
): CategorizedError[] {
    const categorized: CategorizedError[] = [];

    // Process validation items for detailed error info
    if (validationItems) {
        for (const item of validationItems) {
            if (!item.isAvailable) {
                let type: ValidationErrorType = "general";
                if (item.errorMessage?.includes("库存不足")) {
                    type = "inventory";
                } else if (
                    item.errorMessage?.includes("下架") ||
                    item.errorMessage?.includes("不存在")
                ) {
                    type = "unavailable";
                }

                categorized.push({
                    type,
                    message: item.errorMessage || "商品不可用",
                    productName: item.productName,
                    availableQuantity: item.availableQuantity ?? undefined,
                    requestedQuantity: item.requestedQuantity,
                });
            }
        }
    }

    // Add any remaining errors not covered by validation items
    for (const error of errors) {
        const alreadyCovered = categorized.some((c) => c.message === error);
        if (!alreadyCovered && !error.includes("库存不足") && !error.includes("下架")) {
            categorized.push({
                type: "general",
                message: error,
            });
        }
    }

    return categorized;
}

/**
 * Validation errors display component
 * Requirement 5.6: Display specific error messages for inventory issues
 */
function ValidationErrors({
    errors,
    validationItems,
}: {
    errors: string[];
    validationItems?: InventoryValidationItem[];
}) {
    if (errors.length === 0) return null;

    const categorizedErrors = categorizeErrors(errors, validationItems);
    const inventoryErrors = categorizedErrors.filter((e) => e.type === "inventory");
    const unavailableErrors = categorizedErrors.filter((e) => e.type === "unavailable");
    const generalErrors = categorizedErrors.filter((e) => e.type === "general");

    return (
        <div className="space-y-4">
            {/* Main error banner */}
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

            {/* Inventory errors - most actionable */}
            {inventoryErrors.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <svg
                            className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                        </svg>
                        <div className="flex-1">
                            <h5 className="font-medium text-amber-700 dark:text-amber-500">
                                库存不足
                            </h5>
                            <p className="mt-1 text-sm text-amber-600/80 dark:text-amber-400/80">
                                以下商品库存不足，请调整购买数量
                            </p>
                            <ul className="mt-3 space-y-2">
                                {inventoryErrors.map((error, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center justify-between text-sm bg-amber-500/10 rounded px-3 py-2"
                                    >
                                        <span className="text-amber-700 dark:text-amber-400">
                                            {error.productName}
                                        </span>
                                        <span className="text-amber-600 dark:text-amber-500">
                                            需要 {error.requestedQuantity} 件，仅剩{" "}
                                            {error.availableQuantity ?? 0} 件
                                        </span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                                    asChild
                                >
                                    <Link to="/cart">返回购物车修改数量</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unavailable product errors */}
            {unavailableErrors.length > 0 && (
                <div className="rounded-lg border border-gray-500/50 bg-gray-500/10 p-4">
                    <div className="flex items-start gap-3">
                        <svg
                            className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                            />
                        </svg>
                        <div className="flex-1">
                            <h5 className="font-medium text-gray-700 dark:text-gray-400">
                                商品不可用
                            </h5>
                            <p className="mt-1 text-sm text-gray-600/80 dark:text-gray-500/80">
                                以下商品已下架或不存在，请从购物车中移除
                            </p>
                            <ul className="mt-3 space-y-1">
                                {unavailableErrors.map((error, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                        {error.productName} - {error.message}
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-gray-500/50 text-gray-700 hover:bg-gray-500/10"
                                    asChild
                                >
                                    <Link to="/cart">返回购物车移除商品</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General errors */}
            {generalErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <ul className="space-y-1 text-sm text-destructive/90">
                        {generalErrors.map((error, index) => (
                            <li key={index} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-destructive/50" />
                                {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/**
 * CheckoutPage component
 * Requirements: 5.2, 5.6
 */
export function CheckoutPage({ cart, validation, error }: CheckoutPageProps) {
    const fetcher = useFetcher<CheckoutActionResult>();
    const isSubmitting = fetcher.state === "submitting";

    // Handle redirect to Stripe checkout
    useEffect(() => {
        if (fetcher.data?.success && fetcher.data.redirectUrl) {
            window.location.href = fetcher.data.redirectUrl;
        }
    }, [fetcher.data]);

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
                        <p className="text-text-muted mb-6">
                            请先添加商品到购物车
                        </p>
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
    const actionError = fetcher.data?.error;
    const actionValidationDetails = fetcher.data?.validationDetails;

    // Build validation item map for quick lookup
    const validationItemMap = new Map<string, InventoryValidationItem>();
    if (validation?.inventoryValidation.items) {
        for (const item of validation.inventoryValidation.items) {
            validationItemMap.set(item.cartItemId, item);
        }
    }
    // Also include action validation details if available
    if (actionValidationDetails) {
        for (const item of actionValidationDetails) {
            validationItemMap.set(item.cartItemId, item);
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-2xl font-bold text-text-primary mb-6">确认订单</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Order Items */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Validation Errors - Requirement 5.6 */}
                    {hasValidationErrors && validation && (
                        <ValidationErrors
                            errors={validation.errors}
                            validationItems={validation.inventoryValidation.items}
                        />
                    )}

                    {/* Action Error - Requirement 5.6 */}
                    {actionError && (
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
                                <div className="flex-1">
                                    <h4 className="font-medium text-destructive">结算失败</h4>
                                    <p className="mt-1 text-sm text-destructive/80">
                                        {actionError.message}
                                    </p>

                                    {/* Detailed validation errors from action - Requirement 5.6 */}
                                    {actionError.code === "INVENTORY_VALIDATION_FAILED" && actionValidationDetails && actionValidationDetails.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {actionValidationDetails.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between text-sm bg-destructive/10 rounded px-3 py-2"
                                                >
                                                    <span className="text-destructive/90">
                                                        {item.productName}
                                                    </span>
                                                    <span className="text-destructive/70">
                                                        {item.errorMessage}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {actionError.code === "INVENTORY_VALIDATION_FAILED" && (
                                        <div className="mt-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-destructive/50 text-destructive hover:bg-destructive/10"
                                                asChild
                                            >
                                                <Link to="/cart">返回购物车检查</Link>
                                            </Button>
                                        </div>
                                    )}
                                    {actionError.code === "STRIPE_SESSION_FAILED" && (
                                        <p className="mt-2 text-xs text-destructive/60">
                                            支付服务暂时不可用，请稍后重试或联系客服
                                        </p>
                                    )}
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
                            <fetcher.Form method="post" className="pt-2">
                                <input type="hidden" name="intent" value="checkout" />
                                <Button
                                    type="submit"
                                    className="w-full"
                                    size="lg"
                                    disabled={hasValidationErrors || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg
                                                className="animate-spin -ml-1 mr-2 h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                            >
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                />
                                            </svg>
                                            处理中...
                                        </>
                                    ) : (
                                        "确认支付"
                                    )}
                                </Button>
                            </fetcher.Form>

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
