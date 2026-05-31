/**
 * Recent Orders Card Component
 * 
 * Display recent orders with status badges
 */

import { Link } from "react-router";
import { ChevronRight, Package } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { OrderSummary } from "~/lib/user";

interface RecentOrdersCardProps {
    orders: OrderSummary[];
}

export function RecentOrdersCard({ orders }: RecentOrdersCardProps) {
    if (orders.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">最近订单</h3>
                <div className="text-center py-8">
                    <Package className="h-12 w-12 text-text-muted mx-auto mb-3" />
                    <p className="text-text-secondary mb-4">暂无订单记录</p>
                    <Link
                        to="/"
                        className="text-accent hover:underline"
                    >
                        去购物 →
                    </Link>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">最近订单</h3>
                <Link
                    to="/account/orders"
                    className="text-sm text-accent hover:underline flex items-center gap-1"
                >
                    查看全部
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="space-y-3">
                {orders.map((order) => (
                    <OrderItem key={order.id} order={order} />
                ))}
            </div>
        </Card>
    );
}

function OrderItem({ order }: { order: OrderSummary }) {
    const statusConfig = getStatusConfig(order.status);
    const formattedDate = new Date(order.created_at).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <Link
            to={`/account/orders/${order.id}`}
            className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
        >
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
                    <statusConfig.icon className={`h-5 w-5 ${statusConfig.color}`} />
                </div>
                <div>
                    <p className="font-medium text-text-primary">
                        {order.order_number}
                    </p>
                    <p className="text-sm text-text-muted">
                        {formattedDate} · {order.item_count} 件商品
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right">
                    <p className="font-semibold text-text-primary">
                        ¥{order.total_amount.toFixed(2)}
                    </p>
                    <Badge variant="secondary" className={statusConfig.badgeClass}>
                        {statusConfig.label}
                    </Badge>
                </div>
                <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-text-secondary transition-colors" />
            </div>
        </Link>
    );
}

function getStatusConfig(status: string) {
    const configs: Record<string, {
        label: string;
        color: string;
        bgColor: string;
        badgeClass: string;
        icon: React.ComponentType<{ className?: string }>;
    }> = {
        created: {
            label: "待付款",
            color: "text-yellow-500",
            bgColor: "bg-yellow-500/10",
            badgeClass: "bg-yellow-500/10 text-yellow-500",
            icon: Package,
        },
        pending_payment: {
            label: "待付款",
            color: "text-yellow-500",
            bgColor: "bg-yellow-500/10",
            badgeClass: "bg-yellow-500/10 text-yellow-500",
            icon: Package,
        },
        paid: {
            label: "处理中",
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            badgeClass: "bg-blue-500/10 text-blue-500",
            icon: Package,
        },
        fulfilled: {
            label: "已发货",
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
            badgeClass: "bg-purple-500/10 text-purple-500",
            icon: Package,
        },
        completed: {
            label: "已完成",
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            badgeClass: "bg-green-500/10 text-green-500",
            icon: Package,
        },
        cancelled: {
            label: "已取消",
            color: "text-red-500",
            bgColor: "bg-red-500/10",
            badgeClass: "bg-red-500/10 text-red-500",
            icon: Package,
        },
    };

    return configs[status] || configs.created;
}
