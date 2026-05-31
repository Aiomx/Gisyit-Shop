/**
 * Checkout Return Page
 * 
 * Handles return from Stripe Embedded Checkout.
 * Displays payment status and order confirmation.
 * Handles expired orders and payment failure return flow.
 * 
 * Requirements: 5.5
 */

import { RootLayout } from "~/components/layout";
import { CheckoutReturn } from "~/components/checkout/embedded-checkout";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Link, useLoaderData } from "react-router";
import type { StoreSection } from "~/lib/sections";

interface LoaderData {
    sessionId: string | null;
    status: "complete" | "open" | "expired" | null;
    customerEmail?: string;
    error?: string;
    user?: {
        email?: string;
        isLoggedIn: boolean;
    };
    orderExpired?: boolean;
    orderNumber?: string;
    sections: StoreSection[];
}

export async function loader({ request }: { request: Request }): Promise<Response> {
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCheckoutSessionStatus } = await import("~/lib/stripe/stripe.server");
    const { getOrderWithExpirationCheck } = await import("~/lib/order/pending-order.server");
    const { getSupabaseClient } = await import("~/lib/supabase/client.server");
    const { getSections } = await import("~/lib/sections/index.server");

    const user = await getUserForHeader(request);
    const sections = await getSections();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
        return Response.json({
            sessionId: null,
            status: null,
            error: "Missing session ID",
            user,
            sections,
        } satisfies LoaderData);
    }

    try {
        const sessionStatus = await getCheckoutSessionStatus(sessionId);

        if (!sessionStatus) {
            return Response.json({
                sessionId,
                status: null,
                error: "Failed to retrieve session status",
                user,
                sections,
            } satisfies LoaderData);
        }

        // For incomplete payments, check if the order is still valid (Requirements 5.5)
        let orderExpired = false;
        let orderNumber: string | undefined;

        if (sessionStatus.status === "open") {
            try {
                // Look up the order by stripe_session_id
                const supabase = getSupabaseClient();
                const { data: order } = await supabase
                    .from("orders")
                    .select("id, order_number, status")
                    .eq("stripe_session_id", sessionId)
                    .single();

                if (order) {
                    orderNumber = order.order_number;

                    // Check if order is expired
                    const orderResult = await getOrderWithExpirationCheck(order.id);
                    if (orderResult.success && orderResult.order) {
                        orderExpired = orderResult.order.status === "cancelled";
                    }
                }
            } catch (err) {
                console.error("[Checkout Return] Error checking order status:", err);
                // Continue without order info
            }
        }

        return Response.json({
            sessionId,
            status: sessionStatus.status as "complete" | "open" | "expired",
            customerEmail: sessionStatus.customerEmail,
            user,
            orderExpired,
            orderNumber,
            sections,
        } satisfies LoaderData);
    } catch (error) {
        console.error("[Checkout Return] Error:", error);
        return Response.json({
            sessionId,
            status: null,
            error: error instanceof Error ? error.message : "Unknown error",
            user,
            sections,
        } satisfies LoaderData);
    }
}

export function meta() {
    return [
        { title: "支付结果 - Gisyit Shop" },
        { name: "description", content: "查看支付结果" },
    ];
}

export default function CheckoutReturnRoute() {
    const loaderData = useLoaderData() as LoaderData;
    const { sessionId, status, customerEmail, error, user, orderExpired, orderNumber, sections } = loaderData;

    // Convert user to proper format for RootLayout
    const userForLayout = user?.isLoggedIn && user.email
        ? { email: user.email, isLoggedIn: true as const }
        : { isLoggedIn: false as const };

    return (
        <RootLayout cartItemCount={0} user={userForLayout} sections={sections}>
            <div className="max-w-2xl mx-auto py-8 px-4">
                <Card>
                    <CardContent className="py-8">
                        {error ? (
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                                    <svg
                                        className="w-8 h-8 text-destructive"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-text-primary mb-2">
                                    出错了
                                </h2>
                                <p className="text-text-muted mb-6">{error}</p>
                                <Button asChild>
                                    <Link to="/checkout">返回结算</Link>
                                </Button>
                            </div>
                        ) : (
                            <>
                                <CheckoutReturn
                                    sessionId={sessionId || undefined}
                                    status={status || undefined}
                                />

                                {status === "complete" && (
                                    <div className="mt-8 space-y-4">
                                        {customerEmail && (
                                            <p className="text-center text-sm text-text-muted">
                                                确认邮件已发送至 {customerEmail}
                                            </p>
                                        )}
                                        <div className="flex justify-center gap-4">
                                            <Button asChild>
                                                <Link to="/account/orders">查看订单</Link>
                                            </Button>
                                            <Button variant="outline" asChild>
                                                <Link to="/">继续购物</Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Payment incomplete - order expired (Requirements 5.5) */}
                                {status === "open" && orderExpired && (
                                    <div className="mt-8 text-center">
                                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 mb-6">
                                            <svg
                                                className="w-12 h-12 mx-auto text-destructive mb-3"
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
                                            <h3 className="text-lg font-medium text-text-primary mb-2">
                                                订单已过期
                                            </h3>
                                            <p className="text-text-muted text-sm">
                                                {orderNumber && `订单 ${orderNumber} `}已超出 5 分钟支付时限，请重新下单
                                            </p>
                                        </div>
                                        <div className="flex justify-center gap-4">
                                            <Button variant="outline" asChild>
                                                <Link to="/cart">返回购物车</Link>
                                            </Button>
                                            <Button asChild>
                                                <Link to="/">继续购物</Link>
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Payment incomplete - order still valid (Requirements 5.5) */}
                                {status === "open" && !orderExpired && (
                                    <div className="mt-8 text-center">
                                        <p className="text-text-muted mb-4">
                                            支付尚未完成，您可以返回继续支付
                                        </p>
                                        <Button asChild>
                                            <Link to="/checkout">返回结算</Link>
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </RootLayout>
    );
}
