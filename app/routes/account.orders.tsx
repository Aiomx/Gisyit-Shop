/**
 * Account Orders Page Route
 *
 * Displays user's order history with order number, date, status, and amount.
 * Requires user authentication.
 *
 * Requirements: 7.1, 7.2
 */

import type { LoaderFunctionArgs } from "react-router";
import { RootLayout } from "~/components/layout";
import { OrderList } from "~/components/account";
import { getUserOrders } from "~/lib/order";
import type { Order } from "~/lib/supabase/types";
import type { UserMenuInfo } from "~/components/auth";

/**
 * Orders Loader - Load user's orders
 * Requirements: 7.1
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const { requireUserSession, getUserIdFromSession, getUserForHeader } = await import("~/lib/auth/auth.server");

    // Require authentication
    await requireUserSession(request);

    // Get user ID from session
    const userId = await getUserIdFromSession(request);

    if (!userId) {
        throw new Response(null, {
            status: 302,
            headers: {
                Location: "/auth/login?returnTo=/account/orders",
            },
        });
    }

    // Get user info for header
    const user = await getUserForHeader(request);

    // Fetch user's orders
    const result = await getUserOrders(userId);

    if (!result.success) {
        console.error("Failed to load orders:", result.error);
        return {
            orders: [],
            user,
            error: result.error,
        };
    }

    return {
        orders: result.orders || [],
        user,
        error: null,
    };
}

export function meta() {
    return [
        { title: "我的订单 - Gisyit Shop" },
        { name: "description", content: "查看您的订单历史" },
    ];
}

interface LoaderData {
    orders: Order[];
    user: UserMenuInfo;
    error: { code: string; message: string } | null;
}

/**
 * Account Orders Page Component
 * Requirements: 7.1, 7.2
 */
export default function AccountOrdersRoute({ loaderData }: { loaderData: LoaderData }) {
    const { orders, user, error } = loaderData;

    // Show error state
    if (error) {
        return (
            <RootLayout cartItemCount={0} user={user}>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-text-primary mb-6">我的订单</h1>
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-lg">
                        加载订单失败：{error.message}
                    </div>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={0} user={user}>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-text-primary mb-6">我的订单</h1>
                <OrderList orders={orders} />
            </div>
        </RootLayout>
    );
}
