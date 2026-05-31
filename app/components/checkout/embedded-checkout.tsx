/**
 * Embedded Checkout Component
 * 
 * Uses Stripe Embedded Checkout for in-page payment.
 * Supports CNY and other currencies.
 * 
 * Requirements 1.2, 1.3: No Card/Panel/Container wrappers, no shadows/borders/backgrounds
 */

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
    EmbeddedCheckoutProvider,
    EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Button } from "~/components/ui/button";

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);

interface EmbeddedCheckoutProps {
    onError?: (error: { code: string; message: string }) => void;
}

export function EmbeddedCheckoutForm({ onError }: EmbeddedCheckoutProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch client secret from server
    const fetchClientSecret = useCallback(async () => {
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
                return null;
            }

            setClientSecret(data.clientSecret);
            return data.clientSecret;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "网络错误";
            setError(errorMessage);
            onError?.({ code: "NETWORK_ERROR", message: errorMessage });
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [onError]);

    // Start checkout process
    const handleStartCheckout = async () => {
        await fetchClientSecret();
    };

    // If we have a client secret, show the embedded checkout
    // Requirements 1.2, 1.3: No Card/Panel/Container wrappers, no shadows/borders/backgrounds
    if (clientSecret) {
        return (
            <div className="w-full">
                <p className="text-sm text-text-muted mb-4">
                    您的支付信息由 Stripe 安全处理，我们不会存储您的卡号信息。
                </p>
                <EmbeddedCheckoutProvider
                    stripe={stripePromise}
                    options={{ clientSecret }}
                >
                    <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
            </div>
        );
    }

    // Show start checkout button
    return (
        <div className="w-full space-y-4">
            <p className="text-sm text-text-muted">
                点击下方按钮加载安全支付表单
            </p>
            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
                onClick={handleStartCheckout}
                disabled={isLoading}
                className="w-full"
                size="lg"
            >
                {isLoading ? (
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
                        加载支付...
                    </>
                ) : (
                    "确认支付"
                )}
            </Button>
        </div>
    );
}

/**
 * Checkout Return Handler
 * 
 * Handles the return from Stripe Embedded Checkout.
 */
export function CheckoutReturn({
    status,
}: {
    sessionId?: string;
    status?: "complete" | "open" | "expired";
}) {
    if (status === "complete") {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                    支付成功！
                </h2>
                <p className="text-text-muted">
                    感谢您的购买，订单正在处理中。
                </p>
            </div>
        );
    }

    if (status === "open") {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <svg
                        className="w-8 h-8 text-amber-600 dark:text-amber-400"
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
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">
                    支付处理中
                </h2>
                <p className="text-text-muted">
                    您的支付正在处理，请稍候...
                </p>
            </div>
        );
    }

    return (
        <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg
                    className="w-8 h-8 text-gray-600 dark:text-gray-400"
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
            <h2 className="text-2xl font-bold text-text-primary mb-2">
                支付状态未知
            </h2>
            <p className="text-text-muted">
                请检查您的订单状态或联系客服。
            </p>
        </div>
    );
}
