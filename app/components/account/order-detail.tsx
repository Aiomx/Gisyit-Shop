/**
 * OrderDetail Component
 *
 * Displays order details including items and delivery status.
 *
 * Requirements: 7.3
 * - Show order items and delivery status
 */

import type { Order, OrderItem, OrderStatus } from "~/lib/supabase/types";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

interface OrderDetailProps {
    order: Order & { items?: OrderItem[] };
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
        hour: "2-digit",
        minute: "2-digit",
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
 * Format spec combination for display
 */
function formatSpecCombination(specCombination?: Record<string, string>): string {
    if (!specCombination || Object.keys(specCombination).length === 0) {
        return "";
    }
    return Object.entries(specCombination)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" / ");
}

/**
 * Single order item display
 * Requirements: 7.3 - Display order items
 */
function OrderItemRow({ item }: { item: OrderItem }) {
    const specText = formatSpecCombination(item.spec_combination);

    return (
        <div className="flex items-start justify-between py-4 border-b border-border last:border-b-0">
            <div className="flex-1">
                <p className="font-medium text-text-primary">{item.product_name}</p>
                <p className="text-sm text-text-secondary">{item.product_code}</p>
                {specText && (
                    <p className="text-sm text-text-secondary mt-1">{specText}</p>
                )}
            </div>
            <div className="text-right">
                <p className="font-medium text-text-primary">
                    {formatAmount(item.price, item.currency)} × {item.quantity}
                </p>
                <p className="text-sm text-text-secondary">
                    小计: {formatAmount(item.price * item.quantity, item.currency)}
                </p>
            </div>
        </div>
    );
}

/**
 * Order header with status and basic info
 */
function OrderHeader({ order }: { order: Order }) {
    const statusDisplay = getStatusDisplay(order.status);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 className="text-2xl font-bold text-text-primary">
                    订单 {order.order_number}
                </h1>
                <p className="text-text-secondary mt-1">
                    下单时间: {formatDate(order.created_at)}
                </p>
            </div>
            <Badge variant={statusDisplay.variant} className="self-start sm:self-auto">
                {statusDisplay.label}
            </Badge>
        </div>
    );
}

/**
 * Delivery status section
 * Requirements: 7.3 - Display delivery status
 */
function DeliveryStatus({ order }: { order: Order }) {
    // Determine delivery status based on order status
    const getDeliveryInfo = (status: OrderStatus): { title: string; description: string } => {
        switch (status) {
            case "created":
            case "pending_payment":
                return {
                    title: "等待支付",
                    description: "订单尚未支付，请完成支付后等待发货",
                };
            case "paid":
                return {
                    title: "准备发货",
                    description: "订单已支付，正在准备发货",
                };
            case "fulfilled":
                return {
                    title: "已发货",
                    description: "商品已发出，请注意查收",
                };
            case "completed":
                return {
                    title: "已完成",
                    description: "订单已完成，感谢您的购买",
                };
            case "cancelled":
                return {
                    title: "已取消",
                    description: "订单已取消",
                };
            default:
                return {
                    title: "处理中",
                    description: "订单正在处理中",
                };
        }
    };

    const deliveryInfo = getDeliveryInfo(order.status);

    return (
        <Card className="p-4 mb-6">
            <h2 className="font-semibold text-text-primary mb-2">配送状态</h2>
            <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div>
                    <p className="font-medium text-text-primary">{deliveryInfo.title}</p>
                    <p className="text-sm text-text-secondary">{deliveryInfo.description}</p>
                </div>
            </div>
        </Card>
    );
}

/**
 * Order summary section
 */
function OrderSummary({ order }: { order: Order }) {
    return (
        <Card className="p-4">
            <div className="flex justify-between items-center">
                <span className="text-text-secondary">订单总额</span>
                <span className="text-xl font-bold text-text-primary">
                    {formatAmount(order.total_amount, order.currency)}
                </span>
            </div>
        </Card>
    );
}

/**
 * OrderDetail Component
 * Displays complete order information
 * Requirements: 7.3
 */
export function OrderDetail({ order }: OrderDetailProps) {
    const items = order.items || [];

    return (
        <div className="space-y-6">
            {/* Order Header */}
            <OrderHeader order={order} />

            {/* Delivery Status - Requirements 7.3 */}
            <DeliveryStatus order={order} />

            {/* Order Items - Requirements 7.3 */}
            <Card className="p-4">
                <h2 className="font-semibold text-text-primary mb-4">订单商品</h2>
                {items.length > 0 ? (
                    <div className="divide-y divide-border">
                        {items.map((item) => (
                            <OrderItemRow key={item.id} item={item} />
                        ))}
                    </div>
                ) : (
                    <p className="text-text-secondary">暂无商品信息</p>
                )}
            </Card>

            {/* Order Summary */}
            <OrderSummary order={order} />
        </div>
    );
}

/**
 * Utility function to extract order detail display fields
 * Used for property testing - Requirements 7.3
 */
export function extractOrderDetailFields(order: Order & { items?: OrderItem[] }): {
    orderNumber: string;
    date: string;
    status: string;
    amount: string;
    itemCount: number;
    hasDeliveryStatus: boolean;
} {
    const statusDisplay = getStatusDisplay(order.status);
    return {
        orderNumber: order.order_number,
        date: formatDate(order.created_at),
        status: statusDisplay.label,
        amount: formatAmount(order.total_amount, order.currency),
        itemCount: order.items?.length || 0,
        hasDeliveryStatus: true, // DeliveryStatus component is always rendered
    };
}
