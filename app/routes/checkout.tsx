/**
 * Checkout Page Route
 *
 * Validates cart inventory and displays embedded Stripe checkout.
 * Uses Stripe Embedded Checkout for in-page payment experience.
 * Creates pending order on page load with 15-minute payment window.
 *
 * Requirements: 1.1, 3.1, 3.4, 4.1, 5.1, 5.2, 5.3, 5.5, 5.6, 8.4
 */

import type { Route } from "./+types/checkout";
import { RootLayout } from "~/components/layout";
import { CheckoutPaymentPage } from "~/components/checkout";
import {
    validateCheckout,
    CheckoutErrorCodes,
} from "~/lib/checkout";
import type {
    CheckoutLoaderData,
    PendingOrderInfo,
} from "~/lib/checkout/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Checkout Loader - Load cart, validate, and create/load pending order
 * Requirements: 3.1, 3.4, 4.1, 4.5, 5.1, 8.1
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCartIdentifier } = await import("~/lib/cart/session.server");
    const { getSections } = await import("~/lib/sections/index.server");
    const {
        createPendingOrder,
        calculateRemainingTime,
        getOrderWithExpirationCheck,
    } = await import("~/lib/order/pending-order.server");
    const { getSupabaseClient } = await import("~/lib/supabase/client.server");

    // Get user info for header display (Requirements 4.5)
    const user = await getUserForHeader(request);

    // Get sections for navigation
    const sections = await getSections();

    const result = await getCart(request);

    if (!result.success || !result.data?.cart) {
        return Response.json({
            cart: null,
            validation: null,
            itemCount: 0,
            error: {
                code: CheckoutErrorCodes.CART_NOT_FOUND,
                message: "购物车不存在或已过期",
            },
            user,
            sections,
        });
    }

    const cart = result.data.cart;
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    // Check if cart is empty
    if (cart.items.length === 0) {
        return Response.json({
            cart: null,
            validation: null,
            itemCount: 0,
            error: {
                code: CheckoutErrorCodes.CART_EMPTY,
                message: "购物车为空，请先添加商品",
            },
            user,
            sections,
        });
    }

    // Validate cart for checkout (Requirement 5.1)
    const validation = await validateCheckout(cart);

    // If validation fails, return early without creating pending order
    if (!validation.valid) {
        const headers = new Headers();
        if (result.data.setCookie) {
            headers.set("Set-Cookie", result.data.setCookie);
        }

        return Response.json(
            {
                cart: {
                    id: cart.id,
                    items: cart.items,
                },
                validation,
                itemCount,
                error: null,
                user,
                sections,
            },
            { headers }
        );
    }

    // Get user identity for pending order
    const cartIdentifier = await getCartIdentifier(request);
    const userId = cartIdentifier.type === "user" ? cartIdentifier.id : undefined;
    const anonymousSessionId = cartIdentifier.type === "session" ? cartIdentifier.id : undefined;

    // Check if there's an existing pending order for this cart (Requirements 3.1, 4.1)
    let pendingOrder: PendingOrderInfo | undefined;

    try {
        const supabase = getSupabaseClient();

        // Look for existing pending order for this cart
        const { data: existingOrder } = await supabase
            .from("orders")
            .select("id, order_number, created_at, expires_at, status")
            .eq("cart_id", cart.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (existingOrder) {
            // Check if the existing order is expired (Requirements 4.1)
            const orderResult = await getOrderWithExpirationCheck(existingOrder.id);

            if (orderResult.success && orderResult.order) {
                const order = orderResult.order;

                if (order.status === "pending") {
                    // Order is still valid, use it
                    const { remainingSeconds, isExpired } = calculateRemainingTime(order.createdAt);

                    if (!isExpired) {
                        pendingOrder = {
                            id: order.id,
                            orderNumber: order.orderNumber,
                            createdAt: order.createdAt,
                            expiresAt: order.expiresAt,
                            remainingSeconds,
                        };
                    }
                }
                // If order is cancelled (expired), we'll create a new one below
            }
        }

        // If no valid pending order exists, create one (Requirements 3.1)
        if (!pendingOrder) {
            const totalAmount = cart.items.reduce(
                (sum, item) => sum + item.snapshot_price * item.quantity,
                0
            );
            const currency = cart.items[0]?.snapshot_currency || "CNY";

            const orderResult = await createPendingOrder({
                cartId: cart.id,
                cartItems: cart.items,
                userId,
                anonymousSessionId,
                totalAmount,
                currency,
            });

            if (orderResult.success && orderResult.order) {
                const order = orderResult.order;
                const { remainingSeconds } = calculateRemainingTime(order.createdAt);

                pendingOrder = {
                    id: order.id,
                    orderNumber: order.orderNumber,
                    createdAt: order.createdAt,
                    expiresAt: order.expiresAt,
                    remainingSeconds,
                };
            }
        }
    } catch (error) {
        console.error("[Checkout Loader] Error handling pending order:", error);
        // Continue without pending order - the payment page will handle this
    }

    const headers = new Headers();
    if (result.data.setCookie) {
        headers.set("Set-Cookie", result.data.setCookie);
    }

    return Response.json(
        {
            cart: {
                id: cart.id,
                items: cart.items,
            },
            validation,
            itemCount,
            error: null,
            user,
            pendingOrder,
            sections,
        },
        { headers }
    );
}

export function meta() {
    return [
        { title: "结算 - Gisyit Shop" },
        { name: "description", content: "确认订单并完成支付" },
    ];
}

/**
 * Checkout Page Component
 * Requirements: 1.1, 3.1, 3.2, 4.5, 5.2, 5.5, 5.6
 */
export default function CheckoutRoute({ loaderData }: Route.ComponentProps) {
    const { cart, validation, itemCount, error, user, pendingOrder, sections } = loaderData as CheckoutLoaderData & { sections: StoreSection[] };

    // Convert user to proper format for RootLayout
    const userForLayout = user?.isLoggedIn && user.email
        ? { email: user.email, isLoggedIn: true as const }
        : { isLoggedIn: false as const };

    return (
        <RootLayout cartItemCount={itemCount} user={userForLayout} sections={sections}>
            <CheckoutPaymentPage
                cart={cart}
                validation={validation}
                pendingOrder={pendingOrder}
                error={error}
            />
        </RootLayout>
    );
}
