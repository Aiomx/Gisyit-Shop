/**
 * Create Embedded Checkout Session API
 *
 * Creates a pending order first, then creates a Stripe Checkout Session.
 * Returns client_secret for client-side initialization.
 * 
 * Requirements: 2.1, 2.6
 * - Create pending order before Stripe session (2.1)
 * - Include order_id in Stripe session metadata (2.6)
 */

type ActionArgs = { request: Request };

export async function action({ request }: ActionArgs) {
    if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getCartIdentifier } = await import("~/lib/cart/session.server");
    const { createEmbeddedCheckoutSession } = await import("~/lib/stripe/stripe.server");
    const { validateCheckout } = await import("~/lib/checkout/checkout-operations.server");
    const { createPendingOrder } = await import("~/lib/order/pending-order.server");

    try {
        // Get cart
        const cartResult = await getCart(request);
        if (!cartResult.success || !cartResult.data?.cart) {
            return Response.json(
                { error: { code: "CART_NOT_FOUND", message: "购物车不存在" } },
                { status: 400 }
            );
        }

        const cart = cartResult.data.cart;
        if (cart.items.length === 0) {
            return Response.json(
                { error: { code: "CART_EMPTY", message: "购物车为空" } },
                { status: 400 }
            );
        }

        // Validate cart
        const validation = await validateCheckout(cart);
        if (!validation.valid) {
            return Response.json(
                {
                    error: {
                        code: "VALIDATION_FAILED",
                        message: validation.errors.join("; "),
                    },
                },
                { status: 400 }
            );
        }

        // Get user identity
        const cartIdentifier = await getCartIdentifier(request);
        const userId = cartIdentifier.type === "user" ? cartIdentifier.id : undefined;
        const anonymousSessionId = cartIdentifier.type === "session" ? cartIdentifier.id : undefined;

        // Calculate total amount
        const totalAmount = cart.items.reduce(
            (sum, item) => sum + item.snapshot_price * item.quantity,
            0
        );
        const currency = cart.items[0]?.snapshot_currency || "CNY";

        // Step 1: Create pending order BEFORE Stripe session (Requirements 2.1)
        const orderResult = await createPendingOrder({
            cartId: cart.id,
            cartItems: cart.items,
            userId,
            anonymousSessionId,
            totalAmount,
            currency,
        });

        if (!orderResult.success || !orderResult.order) {
            console.error("[Checkout API] Failed to create pending order:", orderResult.error);
            return Response.json(
                {
                    error: orderResult.error || {
                        code: "ORDER_CREATION_FAILED",
                        message: "创建订单失败，请重试"
                    }
                },
                { status: 500 }
            );
        }

        const pendingOrder = orderResult.order;
        console.log("[Checkout API] Pending order created:", pendingOrder.id);

        // Build return URL
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        const returnUrl = `${baseUrl}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

        // Build line items from cart
        const lineItems = cart.items.map((item) => ({
            name: item.product?.name || "商品",
            description: item.product?.subtitle || undefined,
            unitAmount: Math.round(item.snapshot_price * 100), // Convert to cents
            currency: item.snapshot_currency.toLowerCase(),
            quantity: item.quantity,
            images: item.product?.images
                ?.filter((img) => img.is_primary)
                .map((img) => img.image_url),
            metadata: {
                product_id: item.product_id,
                price_id: item.price_id,
            },
        }));

        // Step 2: Create embedded checkout session with order_id in metadata (Requirements 2.6)
        const result = await createEmbeddedCheckoutSession({
            lineItems,
            cartId: cart.id,
            orderId: pendingOrder.id, // Include order_id in metadata
            userId,
            anonymousSessionId,
            returnUrl,
        });

        if (!result.success) {
            // Note: Order was created but Stripe session failed
            // The order will expire naturally after 15 minutes
            console.error("[Checkout API] Stripe session creation failed after order created:", result.error);
            return Response.json({ error: result.error }, { status: 500 });
        }

        return Response.json({
            clientSecret: result.clientSecret,
            sessionId: result.sessionId,
            orderId: pendingOrder.id,
            orderNumber: pendingOrder.orderNumber,
            expiresAt: pendingOrder.expiresAt,
        });
    } catch (error) {
        console.error("[Checkout API] Error:", error);
        return Response.json(
            {
                error: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : "服务器错误",
                },
            },
            { status: 500 }
        );
    }
}

export async function loader() {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
}
