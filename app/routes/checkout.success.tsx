/**
 * Checkout Success Page Route
 *
 * Displays order confirmation after successful Stripe payment.
 * Fetches order details from Supabase via the session ID.
 *
 * Requirements: 5.5
 */

import type { Route } from "./+types/checkout.success";
import { RootLayout } from "~/components/layout";
import { CheckoutSuccess } from "~/components/checkout";
import { getOrderByStripeSession } from "~/lib/order";
import type { Order, OrderItem } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Loader data type for checkout success page
 */
export interface CheckoutSuccessLoaderData {
    sessionId: string | null;
    order: (Order & { items?: OrderItem[] }) | null;
    error: {
        code: string;
        message: string;
    } | null;
    user?: {
        email?: string;
        isLoggedIn: boolean;
    };
    sections: StoreSection[];
}

/**
 * Checkout Success Loader
 * 
 * Fetches order details using the Stripe session ID.
 * Requirements: 4.5, 5.5
 */
export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getSections } = await import("~/lib/sections/index.server");

    // Get user info for header display (Requirements 4.5)
    const user = await getUserForHeader(request);

    // Get sections for navigation
    const sections = await getSections();

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    // If no session ID, show generic success (edge case)
    if (!sessionId) {
        return Response.json({
            sessionId: null,
            order: null,
            error: null,
            user,
            sections,
        } satisfies CheckoutSuccessLoaderData);
    }

    // Fetch order details from Supabase via session ID
    const orderResult = await getOrderByStripeSession(sessionId);

    if (!orderResult.success || !orderResult.order) {
        // Order not found - might still be processing
        // Show success with session ID but no order details
        return Response.json({
            sessionId,
            order: null,
            error: orderResult.error || null,
            user,
            sections,
        } satisfies CheckoutSuccessLoaderData);
    }

    return Response.json({
        sessionId,
        order: orderResult.order,
        error: null,
        user,
        sections,
    } satisfies CheckoutSuccessLoaderData);
}

export function meta() {
    return [
        { title: "支付成功 - Gisyit Shop" },
        { name: "description", content: "您的订单已成功支付" },
    ];
}

/**
 * Checkout Success Page Component
 * 
 * Displays order confirmation with order details.
 * Requirements: 4.5, 5.5
 */
export default function CheckoutSuccessRoute({ loaderData }: Route.ComponentProps) {
    const { sessionId, order, error, user, sections } = loaderData as CheckoutSuccessLoaderData;

    return (
        <RootLayout cartItemCount={0} user={user} sections={sections}>
            <CheckoutSuccess
                sessionId={sessionId ?? undefined}
                order={order ?? undefined}
                error={error ?? undefined}
            />
        </RootLayout>
    );
}
