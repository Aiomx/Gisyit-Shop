/**
 * Account Order Detail Page Route
 *
 * Displays order details including items and delivery status.
 * Requires user authentication and ownership verification.
 * Shows CDK codes for paid CDK orders.
 *
 * Requirements: 7.1, 7.3, 7.4, 9.2, 9.3
 * Property 15: Order ownership verification
 * Property 17: Unpaid Order Content Hiding
 */

import type { LoaderFunctionArgs } from "react-router";
import { Link } from "react-router";
import { RootLayout } from "~/components/layout";
import { OrderDetail, CDKDisplay } from "~/components/account";
import { getOrderById } from "~/lib/order";
import type { Order, OrderItem } from "~/lib/supabase/types";
import type { UserMenuInfo } from "~/components/auth";
import type { DeliveredCode } from "~/lib/cdk/types";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * Order Detail Loader - Load order with ownership verification
 * Requirements: 7.1, 7.3, 7.4, 9.2, 9.3
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    const { requireUserSession, getUserIdFromSession, getUserForHeader } = await import("~/lib/auth/auth.server");
    const { getDeliveredCodes } = await import("~/lib/cdk/inventory.server");

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

    // Get order ID from params
    const orderId = params.id;

    if (!orderId) {
        throw new Response("订单ID不能为空", { status: 400 });
    }

    // Get user info for header
    const user = await getUserForHeader(request);

    // Fetch order with ownership verification
    // Requirements 9.2, 9.3 - Property 15: Order ownership verification
    const result = await getOrderById(orderId, userId);

    if (!result.success) {
        // Handle different error cases
        if (result.error?.code === "FORBIDDEN") {
            // Requirements 9.3: Return 403 for unauthorized access
            throw new Response(result.error.message, { status: 403 });
        }

        if (result.error?.code === "ORDER_NOT_FOUND") {
            throw new Response(result.error.message, { status: 404 });
        }

        // Other errors
        return {
            order: null,
            user,
            cdkCodes: [],
            error: result.error,
        };
    }

    // Fetch CDK codes for the order (Requirements 7.1, 7.4)
    // getDeliveredCodes handles ownership verification and paid status check internally
    const cdkCodes = await getDeliveredCodes(orderId, userId);

    return {
        order: result.order,
        user,
        cdkCodes,
        error: null,
    };
}

export function meta({ data }: { data?: LoaderData }) {
    const orderNumber = data?.order?.order_number || "订单详情";
    return [
        { title: `${orderNumber} - 我的订单 - Store` },
        { name: "description", content: "查看订单详情" },
    ];
}

interface LoaderData {
    order: (Order & { items?: OrderItem[] }) | null;
    user: UserMenuInfo;
    cdkCodes: DeliveredCode[];
    error: { code: string; message: string } | null;
}

/**
 * Check if order is in a paid status
 * Requirements: 7.4 - Only show CDK codes for paid orders
 */
function isOrderPaid(status: string): boolean {
    const paidStatuses = ["paid", "fulfilled", "completed"];
    return paidStatuses.includes(status);
}

/**
 * Account Order Detail Page Component
 * Requirements: 7.1, 7.3, 7.4
 */
export default function AccountOrderDetailRoute({ loaderData }: { loaderData: LoaderData }) {
    const { order, user, cdkCodes, error } = loaderData;

    // Show error state
    if (error || !order) {
        return (
            <RootLayout cartItemCount={0} user={user}>
                <div className="max-w-4xl mx-auto">
                    <Link
                        to="/account/orders"
                        className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        返回订单列表
                    </Link>
                    <h1 className="text-3xl font-bold text-text-primary mb-6">订单详情</h1>
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-lg">
                        {error?.message || "订单不存在"}
                    </div>
                </div>
            </RootLayout>
        );
    }

    const isPaid = isOrderPaid(order.status);

    return (
        <RootLayout cartItemCount={0} user={user}>
            <div className="max-w-4xl mx-auto">
                <Link
                    to="/account/orders"
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回订单列表
                </Link>
                <OrderDetail order={order} />

                {/* CDK Display Section - Requirements 7.1, 7.4 */}
                {/* Only show CDK section when there are delivered codes */}
                {cdkCodes.length > 0 && (
                    <div className="mt-6">
                        <CDKDisplay
                            codes={cdkCodes}
                            isPaid={isPaid}
                        />
                    </div>
                )}
            </div>
        </RootLayout>
    );
}

/**
 * Error Boundary for 403/404 responses
 */
export function ErrorBoundary({ error }: { error: unknown }) {
    // Check if it's a Response error
    if (error instanceof Response) {
        if (error.status === 403) {
            return (
                <RootLayout cartItemCount={0}>
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-text-primary mb-4">403</h1>
                            <p className="text-text-secondary mb-6">无权访问此订单</p>
                            <Link to="/account/orders">
                                <Button>返回订单列表</Button>
                            </Link>
                        </div>
                    </div>
                </RootLayout>
            );
        }

        if (error.status === 404) {
            return (
                <RootLayout cartItemCount={0}>
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <div className="text-center">
                            <h1 className="text-4xl font-bold text-text-primary mb-4">404</h1>
                            <p className="text-text-secondary mb-6">订单不存在</p>
                            <Link to="/account/orders">
                                <Button>返回订单列表</Button>
                            </Link>
                        </div>
                    </div>
                </RootLayout>
            );
        }
    }

    // Generic error
    return (
        <RootLayout cartItemCount={0}>
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-text-primary mb-4">出错了</h1>
                    <p className="text-text-secondary mb-6">加载订单时发生错误</p>
                    <Link to="/account/orders">
                        <Button>返回订单列表</Button>
                    </Link>
                </div>
            </div>
        </RootLayout>
    );
}
