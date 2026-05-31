/**
 * Order Stats Card Component
 * 
 * Visual display of order statistics with animated counters
 */

import { Package, Clock, Truck, CheckCircle, XCircle, ShoppingBag } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Link } from "react-router";
import type { OrderStats } from "~/lib/user";

interface OrderStatsCardProps {
    stats: OrderStats;
}

export function OrderStatsCard({ stats }: OrderStatsCardProps) {
    const statItems = [
        {
            label: "全部订单",
            value: stats.total,
            icon: ShoppingBag,
            color: "text-accent",
            bgColor: "bg-accent/10",
            filter: "",
        },
        {
            label: "待付款",
            value: stats.pending,
            icon: Clock,
            color: "text-yellow-500",
            bgColor: "bg-yellow-500/10",
            filter: "?status=pending",
        },
        {
            label: "处理中",
            value: stats.processing,
            icon: Package,
            color: "text-blue-500",
            bgColor: "bg-blue-500/10",
            filter: "?status=processing",
        },
        {
            label: "已发货",
            value: stats.shipped,
            icon: Truck,
            color: "text-purple-500",
            bgColor: "bg-purple-500/10",
            filter: "?status=shipped",
        },
        {
            label: "已完成",
            value: stats.completed,
            icon: CheckCircle,
            color: "text-green-500",
            bgColor: "bg-green-500/10",
            filter: "?status=completed",
        },
        {
            label: "已取消",
            value: stats.cancelled,
            icon: XCircle,
            color: "text-red-500",
            bgColor: "bg-red-500/10",
            filter: "?status=cancelled",
        },
    ];

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">订单概览</h3>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {statItems.map((item) => (
                    <Link
                        key={item.label}
                        to={`/account/orders${item.filter}`}
                        className="group"
                    >
                        <div className="flex flex-col items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <div className={`p-3 rounded-xl ${item.bgColor} mb-2 group-hover:scale-110 transition-transform`}>
                                <item.icon className={`h-5 w-5 ${item.color}`} />
                            </div>
                            <span className="text-2xl font-bold text-text-primary">
                                {item.value}
                            </span>
                            <span className="text-xs text-text-muted mt-1">
                                {item.label}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </Card>
    );
}
