/**
 * Checkout Payment Page Component
 *
 * Two-column layout for order payment:
 * - Left: Order info (products, buyer info, countdown)
 * - Right: Stripe Embedded Checkout (no wrapper styling)
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2
 */

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { loadStripe } from "@stripe/stripe-js";
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { CartItemWithProduct } from "~/lib/cart/types";
import type { CheckoutValidationResult } from "~/lib/checkout/types";
import { getProductTypeCategory, TypeBadge } from "~/components/product/type-badge";

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);

// ============================================
// Types
// ============================================

export interface PendingOrderInfo {
    id: string;
    orderNumber: string;
    createdAt: string;
    expiresAt: string;
    remainingSeconds: number;
}

export interface CheckoutPaymentPageProps {
    cart: {
        id: string;
        items: CartItemWithProduct[];
    } | null;
    validation: CheckoutValidationResult | null;
    pendingOrder?: PendingOrderInfo;
    error?: { code: string; message: string } | null;
}

// ============================================
// Helper Functions
// ============================================

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
 * Format remaining time as MM:SS
 */
function formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Countdown timer display
 * Shows remaining payment time (server-calculated, Requirements 3.1, 3.2)
 */
function PaymentCountdown({
    remainingSeconds,
    isExpired,
}: {
    remainingSeconds: number;
    isExpired: boolean;
}) {
    // Local countdown state - decrements from server-provided value
    const [localSeconds, setLocalSeconds] = useState(remainingSeconds);

    useEffect(() => {
        // Reset when server value changes (e.g., page refresh)
        setLocalSeconds(remainingSeconds);
    }, [remainingSeconds]);

    useEffect(() => {
        if (localSeconds <= 0) return;

        const timer = setInterval(() => {
            setLocalSeconds((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [localSeconds]);

    const expired = isExpired || localSeconds <= 0;
    const isWarning = !expired && localSeconds <= 120; // Last 2 minutes

    if (expired) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <svg
                    className="w-5 h-5 text-destructive flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span className="text-destructive font-medium">支付已过期</span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg border",
                isWarning
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "bg-accent/5 border-accent/20"
            )}
        >
            <svg
                className={cn(
                    "w-5 h-5 flex-shrink-0",
                    isWarning ? "text-amber-600" : "text-accent"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            <span className={cn("font-medium", isWarning ? "text-amber-600" : "text-accent")}>
                剩余支付时间：{formatRemainingTime(localSeconds)}
            </span>
        </div>
    );
}

/**
 * Order item row component
 */
function OrderItemRow({ item }: { item: CartItemWithProduct }) {
    const productType = item.product?.product_type;
    const typeCategory = productType ? getProductTypeCategory(productType) : null;

    return (
        <div className="flex gap-4 py-4 border-b border-border last:border-b-0">
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
                    <div className="min-w-0">
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
                    <div className="text-right flex-shrink-0">
                        <p className="font-medium text-text-primary">
                            {formatPrice(item.snapshot_price * item.quantity, item.snapshot_currency)}
                        </p>
                        <p className="text-sm text-text-muted">
                            {formatPrice(item.snapshot_price, item.snapshot_currency)} × {item.quantity}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Buyer information section
 */
function BuyerInfoSection({ pendingOrder }: { pendingOrder?: PendingOrderInfo }) {
    if (!pendingOrder) return null;

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-muted">订单信息</h3>
            <div className="text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-text-muted">订单号</span>
                    <span className="text-text-primary font-mono">{pendingOrder.orderNumber}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Stripe Embedded Checkout wrapper
 * Requirements 1.2, 1.3: No Card/Panel/Container wrappers, no shadows/borders/backgrounds
 */
function StripeCheckoutSection({
    onError,
}: {
    onError?: (error: { code: string; message: string }) => void;
}) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch client secret on mount
    useEffect(() => {
        const fetchClientSecret = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/checkout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                const data = await response.json();

                if (!response.ok || data.error) {
                    const errorMessage = data.error?.message || "创建支付会话失败";
                    setError(errorMessage);
                    onError?.(data.error || { code: "UNKNOWN", message: errorMessage });
                    return;
                }

                setClientSecret(data.clientSecret);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "网络错误";
                setError(errorMessage);
                onError?.({ code: "NETWORK_ERROR", message: errorMessage });
            } finally {
                setIsLoading(false);
            }
        };

        fetchClientSecret();
    }, [onError]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                    <svg
                        className="animate-spin h-8 w-8 text-accent"
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
                    <span className="text-text-muted">正在加载支付...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                    <svg
                        className="w-6 h-6 text-destructive"
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
                </div>
                <p className="text-destructive mb-4">{error}</p>
                <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                >
                    重试
                </Button>
            </div>
        );
    }

    if (!clientSecret) {
        return null;
    }

    // Render Stripe Embedded Checkout WITHOUT any wrapper styling (Requirements 1.2, 1.3)
    return (
        <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
        >
            <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
    );
}

// ============================================
// Main Component
// ============================================

/**
 * CheckoutPaymentPage - Two-column checkout layout
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2
 */
export function CheckoutPaymentPage({
    cart,
    validation,
    pendingOrder,
    error,
}: CheckoutPaymentPageProps) {
    const [checkoutError, setCheckoutError] = useState<{ code: string; message: string } | null>(null);

    // Calculate remaining time and expiration status
    const remainingSeconds = pendingOrder?.remainingSeconds ?? 0;
    const isExpired = remainingSeconds <= 0;

    // Error state - no cart or general error
    if (error || !cart) {
        return (
            <div className="max-w-2xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-bold text-text-primary mb-6">结算</h1>
                <div className="rounded-lg border border-border bg-bg-secondary p-8 text-center">
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
                </div>
            </div>
        );
    }

    // Expired order state
    if (isExpired && pendingOrder) {
        return (
            <div className="max-w-2xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-bold text-text-primary mb-6">订单已过期</h1>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
                    <svg
                        className="w-16 h-16 mx-auto text-destructive mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <h2 className="text-lg font-medium text-text-primary mb-2">
                        支付时间已过期
                    </h2>
                    <p className="text-text-muted mb-6">
                        订单 {pendingOrder.orderNumber} 已超过15分钟支付时限，请重新下单
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" asChild>
                            <Link to="/cart">返回购物车</Link>
                        </Button>
                        <Button asChild>
                            <Link to="/">继续购物</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const items = cart.items;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold text-text-primary mb-6">确认订单并支付</h1>

            {/* Checkout Error */}
            {checkoutError && (
                <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
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

            {/* Two-column layout (Requirements 1.1, 1.4) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Order Info */}
                <div className="space-y-6">
                    {/* Payment Countdown (Requirements 3.1, 3.2) */}
                    {pendingOrder && (
                        <PaymentCountdown
                            remainingSeconds={remainingSeconds}
                            isExpired={isExpired}
                        />
                    )}

                    {/* Order Items */}
                    <div className="rounded-lg border border-border bg-bg-secondary p-4">
                        <h2 className="text-lg font-semibold text-text-primary mb-4">
                            商品清单 ({itemCount} 件)
                        </h2>
                        <div className="divide-y divide-border">
                            {items.map((item) => (
                                <OrderItemRow key={item.id} item={item} />
                            ))}
                        </div>
                    </div>

                    {/* Buyer Info */}
                    {pendingOrder && (
                        <div className="rounded-lg border border-border bg-bg-secondary p-4">
                            <BuyerInfoSection pendingOrder={pendingOrder} />
                        </div>
                    )}

                    {/* Order Summary */}
                    <div className="rounded-lg border border-border bg-bg-secondary p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-text-muted">商品小计</span>
                            <span className="text-text-primary">
                                {formatPrice(validation?.cartTotal ?? 0, validation?.currency ?? "CNY")}
                            </span>
                        </div>
                        <div className="border-t border-border pt-3">
                            <div className="flex justify-between">
                                <span className="font-medium text-text-primary">合计</span>
                                <span className="text-xl font-semibold text-accent">
                                    {formatPrice(validation?.cartTotal ?? 0, validation?.currency ?? "CNY")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Back to cart */}
                    <Button variant="outline" className="w-full" asChild>
                        <Link to="/cart">返回购物车</Link>
                    </Button>
                </div>

                {/* Right Column: Stripe Payment (Requirements 1.2, 1.3) */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-text-primary">支付方式</h2>

                    {/* Stripe Embedded Checkout - NO wrapper styling */}
                    <StripeCheckoutSection onError={setCheckoutError} />

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
                </div>
            </div>
        </div>
    );
}
