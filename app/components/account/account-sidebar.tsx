/**
 * AccountSidebar Component
 *
 * Sidebar navigation for account pages.
 * Provides navigation to orders, downloads, profile, and other account sections.
 *
 * Requirements: 4.1, 7.1
 */

import { NavLink } from "react-router";
import { Package, User, Settings, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

interface AccountSidebarItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
}

const accountSidebarItems: AccountSidebarItem[] = [
    {
        label: "订单",
        href: "/account/orders",
        icon: Package,
        description: "查看订单历史",
    },
    {
        label: "下载",
        href: "/account/downloads",
        icon: Download,
        description: "下载已购应用",
    },
    {
        label: "个人资料",
        href: "/account/profile",
        icon: User,
        description: "管理个人信息",
    },
    {
        label: "设置",
        href: "/account/settings",
        icon: Settings,
        description: "账户设置",
    },
];

interface AccountSidebarProps {
    className?: string;
}

/**
 * AccountSidebar component for account section navigation
 * Requirements: 7.1 - Navigate to orders, profile, etc.
 */
export function AccountSidebar({ className }: AccountSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col border-r border-border bg-bg-secondary transition-all duration-300",
                collapsed ? "w-16" : "w-56",
                className
            )}
        >
            {/* Collapse toggle */}
            <div className="flex justify-end p-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
                    className="h-8 w-8"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Account section title */}
            {!collapsed && (
                <div className="px-4 py-2">
                    <h2 className="text-sm font-semibold text-text-primary">我的账户</h2>
                </div>
            )}

            {/* Navigation items */}
            <nav className="flex-1 px-2 py-2">
                <ul className="space-y-1">
                    {accountSidebarItems.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                to={item.href}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                                        "hover:bg-bg-tertiary hover:text-text-primary",
                                        isActive
                                            ? "bg-accent/10 text-accent"
                                            : "text-text-secondary"
                                    )
                                }
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                {!collapsed && (
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-sm font-medium">{item.label}</span>
                                        {item.description && (
                                            <span className="text-xs text-text-muted truncate">
                                                {item.description}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Back to store link */}
            {!collapsed && (
                <div className="border-t border-border p-4">
                    <NavLink
                        to="/"
                        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                        ← 返回商店
                    </NavLink>
                </div>
            )}
        </aside>
    );
}

/**
 * Mobile account sidebar navigation (used in Sheet)
 */
export function MobileAccountSidebar() {
    return (
        <nav className="flex flex-col gap-2 py-4">
            <div className="px-3 py-2">
                <h2 className="text-sm font-semibold text-text-primary">我的账户</h2>
            </div>
            {accountSidebarItems.map((item) => (
                <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
                            "hover:bg-bg-tertiary hover:text-text-primary",
                            isActive ? "bg-accent/10 text-accent" : "text-text-secondary"
                        )
                    }
                >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.description && (
                            <span className="text-xs text-text-muted">{item.description}</span>
                        )}
                    </div>
                </NavLink>
            ))}
            <div className="border-t border-border mt-4 pt-4 px-3">
                <NavLink
                    to="/"
                    className="text-sm text-text-muted hover:text-text-secondary transition-colors"
                >
                    ← 返回商店
                </NavLink>
            </div>
        </nav>
    );
}
