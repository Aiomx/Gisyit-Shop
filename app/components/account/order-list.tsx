/**
 * OrderList Component
 *
 * Displays a list of orders with order number, date, status, and amount.
 *
 * Requirements: 7.2
 * - Show order number, date, status, and total amount
 */

import { Link } from "react-router";
import type { Order, OrderStatus } from "~/lib/supabase/types";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

interface OrderListProps {
    orders: Order[];
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Format currency amount for display
 */
function formatAmount(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: currency,
    });
    return formatter.format(amount);
}

/**
 * Order status display configuration
 */
const statusConfig: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    created: { label: "已创建", variant: "outline" },
    pending_payment: { label: "待支付", variant: "secondary" },
    paid: { label: "已支付", variant: "default" },
    fulfilled: { label: "已发货", variant: "default" },
    completed: { label: "已完成", variant: "default" },
    cancelled: { label: "已取消", variant: "destructive" },
};

/**
 * Get status display info
 */
function getStatusDisplay(status: OrderStatus): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
    return statusConfig[status] || { label: status, variant: "outline" };
}

/**
 * Single order item in the list
 * Requirements: 7.2 - Display order number, date, status, and total amount
 */
function OrderItem({ order }: { order: Order }) {
    const statusDisplay = getStatusDisplay(order.status);

    return (
        <Card className="p-4 hover:bg-muted/50 transition-colors">
            <Link to={`/account/orders/${order.id}`} className="block">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        {/* Order Number - Requirements 7.2 */}
                        <p className="font-medium text-text-primary">
                            订单号：{order.order_number}
                        </p>
                        {/* Order Date - Requirements 7.2 */}
                        <p className="text-sm text-text-secondary">
                            {formatDate(order.created_at)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Order Status - Requirements 7.2 */}
                        <Badge variant={statusDisplay.variant}>
                            {statusDisplay.label}
                        </Badge>
                        {/* Order Amount - Requirements 7.2 */}
                        <p className="font-semibold text-text-primary">
                            {formatAmount(order.total_amount, order.currency)}
                        </p>
                    </div>
                </div>
            </Link>
        </Card>
    );
}

/**
 * Empty state when no orders exist
 */
function EmptyState() {
    return (
        <div className="text-center py-12">
            <p className="text-text-secondary mb-4">您还没有任何订单</p>
            <Link
                to="/"
                className="text-primary hover:underline"
            >
                去购物
            </Link>
        </div>
    );
}

/**
 * OrderList Component
 * Displays all orders for the user
 * Requirements: 7.1, 7.2
 */
export function OrderList({ orders }: OrderListProps) {
    if (orders.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => (
                <OrderItem key={order.id} order={order} />
            ))}
        </div>
    );
}

/**
 * Utility function to extract order display fields
 * Used for property testing - Requirements 7.2
 */
export function extractOrderDisplayFields(order: Order): {
    orderNumber: string;
    date: string;
    status: string;
    amount: string;
} {
    const statusDisplay = getStatusDisplay(order.status);
    return {
        orderNumber: order.order_number,
        date: formatDate(order.created_at),
        status: statusDisplay.label,
        amount: formatAmount(order.total_amount, order.currency),
    };
}
