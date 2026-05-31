/**
 * Account Index Page Route
 *
 * Displays account overview with quick links to orders, downloads, profile, etc.
 * Requires user authentication.
 *
 * Requirements: 4.1, 7.1
 */

import type { LoaderFunctionArgs } from "react-router";
import { Link } from "react-router";
import { Package, User, Settings, ChevronRight, Download } from "lucide-react";
import { RootLayout } from "~/components/layout";
import { Card } from "~/components/ui/card";
import { getUserOrders } from "~/lib/order";
import { userHasDownloads } from "~/lib/download/user-downloads.server";
import type { UserMenuInfo } from "~/components/auth";

/**
 * Account Index Loader - Load user info and recent orders
 * Requirements: 4.1, 7.1
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const { requireUserSession, getUserForHeader, getUserIdFromSession } = await import("~/lib/auth/auth.server");

    // Require authentication
    await requireUserSession(request);

    // Get user info for header
    const user = await getUserForHeader(request);

    // Get user ID for orders
    const userId = await getUserIdFromSession(request);

    // Fetch recent orders (limit to 3 for overview)
    let recentOrdersCount = 0;
    let hasDownloads = false;
    if (userId) {
        const result = await getUserOrders(userId);
        if (result.success && result.orders) {
            recentOrdersCount = result.orders.length;
        }
        // Check if user has any downloads
        hasDownloads = await userHasDownloads(userId);
    }

    return {
        user,
        recentOrdersCount,
        hasDownloads,
    };
}

export function meta() {
    return [
        { title: "我的账户 - Gisyit Shop" },
        { name: "description", content: "管理您的账户信息" },
    ];
}

interface LoaderData {
    user: UserMenuInfo;
    recentOrdersCount: number;
    hasDownloads: boolean;
}

interface QuickLinkProps {
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    badge?: string;
}

/**
 * Quick link card component
 */
function QuickLink({ to, icon: Icon, title, description, badge }: QuickLinkProps) {
    return (
        <Link to={to}>
            <Card className="p-4 hover:bg-white/5 transition-colors group">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-accent/10">
                            <Icon className="h-6 w-6 text-accent" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-medium text-text-primary">{title}</h3>
                                {badge && (
                                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                                        {badge}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-text-secondary">{description}</p>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-text-muted group-hover:text-text-secondary transition-colors" />
                </div>
            </Card>
        </Link>
    );
}

/**
 * Account Index Page Component
 * Requirements: 4.1, 7.1 - Display account overview
 */
export default function AccountIndexRoute({ loaderData }: { loaderData: LoaderData }) {
    const { user, recentOrdersCount, hasDownloads } = loaderData;

    return (
        <RootLayout cartItemCount={0} user={user}>
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Welcome section */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">
                        欢迎回来{user.isLoggedIn ? `，${user.email}` : ""}
                    </h1>
                    <p className="text-text-secondary mt-2">
                        在这里管理您的账户信息和订单
                    </p>
                </div>

                {/* Quick links */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-text-primary">快捷入口</h2>

                    <div className="grid gap-4">
                        <QuickLink
                            to="/account/orders"
                            icon={Package}
                            title="我的订单"
                            description="查看订单历史和配送状态"
                            badge={recentOrdersCount > 0 ? `${recentOrdersCount} 个订单` : undefined}
                        />

                        <QuickLink
                            to="/account/downloads"
                            icon={Download}
                            title="我的下载"
                            description="下载已购买的应用和文档"
                            badge={hasDownloads ? "有可下载内容" : undefined}
                        />

                        <QuickLink
                            to="/account/profile"
                            icon={User}
                            title="个人资料"
                            description="管理您的个人信息"
                        />

                        <QuickLink
                            to="/account/settings"
                            icon={Settings}
                            title="账户设置"
                            description="修改密码和安全设置"
                        />
                    </div>
                </div>

                {/* Recent activity section */}
                <div>
                    <h2 className="text-lg font-semibold text-text-primary mb-4">最近活动</h2>
                    <Card className="p-6">
                        {recentOrdersCount > 0 ? (
                            <div className="text-center">
                                <p className="text-text-secondary mb-4">
                                    您有 {recentOrdersCount} 个订单
                                </p>
                                <Link
                                    to="/account/orders"
                                    className="text-accent hover:underline"
                                >
                                    查看全部订单
                                </Link>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-text-secondary mb-4">
                                    您还没有任何订单
                                </p>
                                <Link
                                    to="/"
                                    className="text-accent hover:underline"
                                >
                                    去购物
                                </Link>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </RootLayout>
    );
}
