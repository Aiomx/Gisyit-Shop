/**
 * CheckoutSuccess Component
 *
 * Displays order confirmation after successful payment.
 * Shows order details including order number, items, and total.
 *
 * Requirements: 5.5
 */

import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Order, OrderItem } from "~/lib/supabase/types";

interface CheckoutSuccessProps {
    sessionId?: string;
    order?: Order & { items?: OrderItem[] };
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Format price with currency
 */
function formatPrice(amount: number, currency: string = "CNY"): string {
    if (currency === "CNY") {
        return `¥${amount.toFixed(2)}`;
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
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
 * Order item row component
 */
function OrderItemRow({ item }: { item: OrderItem }) {
    return (
        <div className="flex justify-between items-start py-3 border-b border-border last:border-b-0">
            <div className="flex-1">
                <p className="font-medium text-text-primary">{item.product_name}</p>
                <p className="text-sm text-text-muted">
                    商品编号: {item.product_code}
                </p>
                {item.spec_combination && Object.keys(item.spec_combination).length > 0 && (
                    <p className="text-sm text-text-muted">
                        {Object.entries(item.spec_combination)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(" / ")}
                    </p>
                )}
            </div>
            <div className="text-right">
                <p className="font-medium text-text-primary">
                    {formatPrice(item.price * item.quantity, item.currency)}
                </p>
                <p className="text-sm text-text-muted">
                    {formatPrice(item.price, item.currency)} × {item.quantity}
                </p>
            </div>
        </div>
    );
}

/**
 * CheckoutSuccess component
 * 
 * Displays success message and order summary after payment.
 * Requirements: 5.5
 */
export function CheckoutSuccess({ sessionId, order, error }: CheckoutSuccessProps) {
    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            {/* Success Header */}
            <Card className="mb-6">
                <CardContent className="py-8 text-center">
                    {/* Success Icon */}
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
                        <svg
                            className="w-8 h-8 text-green-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>

                    {/* Success Message */}
                    <h1 className="text-2xl font-bold text-text-primary mb-2">
                        支付成功！
                    </h1>
                    <p className="text-text-muted">
                        感谢您的购买，我们已收到您的订单。
                    </p>
                </CardContent>
            </Card>

            {/* Order Details */}
            {order && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            <span>订单详情</span>
                            <span className="text-sm font-normal text-text-muted">
                                {formatDate(order.created_at)}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Order Info */}
                        <div className="bg-bg-secondary rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-text-muted">订单号</p>
                                    <p className="font-mono font-medium text-text-primary">
                                        {order.order_number}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-text-muted">订单状态</p>
                                    <p className="font-medium text-green-500">
                                        {order.status === "paid" ? "已支付" :
                                            order.status === "fulfilled" ? "已发货" :
                                                order.status === "completed" ? "已完成" : "处理中"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-text-muted mb-3">
                                    商品清单 ({order.items.length} 件)
                                </h3>
                                <div className="divide-y divide-border">
                                    {order.items.map((item) => (
                                        <OrderItemRow key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Order Total */}
                        <div className="border-t border-border pt-4">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-text-primary">订单总额</span>
                                <span className="text-xl font-semibold text-accent">
                                    {formatPrice(order.total_amount, order.currency)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Session Reference (when order not found) */}
            {!order && sessionId && (
                <Card className="mb-6">
                    <CardContent className="py-6">
                        <div className="bg-bg-secondary rounded-lg p-4">
                            <h2 className="text-sm font-medium text-text-muted mb-2">
                                交易参考
                            </h2>
                            <p className="font-mono text-xs text-text-primary break-all">
                                {sessionId}
                            </p>
                            {error && (
                                <p className="text-sm text-amber-500 mt-2">
                                    订单详情正在处理中，请稍后刷新页面查看。
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Next Steps */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-lg">接下来</CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg
                                    className="w-3.5 h-3.5 text-green-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-text-primary">订单确认邮件</p>
                                <p className="text-sm text-text-muted">
                                    您将收到一封包含订单详情的确认邮件
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg
                                    className="w-3.5 h-3.5 text-blue-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-text-primary">数字商品交付</p>
                                <p className="text-sm text-text-muted">
                                    数字商品将在订单处理后发送到您的邮箱
                                </p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg
                                    className="w-3.5 h-3.5 text-purple-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-text-primary">实物商品发货</p>
                                <p className="text-sm text-text-muted">
                                    实物商品将在 1-3 个工作日内发货
                                </p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg">
                    <Link to="/">继续购物</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                    <Link to="/orders">查看我的订单</Link>
                </Button>
            </div>
        </div>
    );
}
