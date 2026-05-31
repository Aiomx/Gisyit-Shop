import { NavLink } from "react-router";
import {
    AppWindow,
    Gamepad2,
    Package,
    Globe,
    ChevronLeft,
    ChevronRight,
    Tag,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    description?: string;
}

const sidebarItems: SidebarItem[] = [
    {
        label: "应用",
        href: "/apps",
        icon: AppWindow,
        description: "Mac & Windows 应用",
    },
    {
        label: "游戏",
        href: "/games",
        icon: Gamepad2,
        description: "点卡、CDK、数字版",
    },
    {
        label: "商店",
        href: "/store",
        icon: Package,
        description: "实物商品",
    },
    {
        label: "海外代购",
        href: "/overseas",
        icon: Globe,
        description: "海外商品代购",
    },
    {
        label: "品牌专栏",
        href: "/brands",
        icon: Tag,
        description: "按品牌浏览商品",
    },
];

interface SidebarProps {
    className?: string;
}

/**
 * Sidebar component for section navigation
 * Requirements 1.2, 1.3, 1.4, 1.5: Navigate to different store sections
 */
export function Sidebar({ className }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col border-r border-border bg-bg-secondary transition-all duration-300",
                collapsed ? "w-16" : "w-64",
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

            {/* Navigation items */}
            <nav className="flex-1 px-2 py-4">
                <ul className="space-y-1">
                    {sidebarItems.map((item) => (
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

            {/* Footer area */}
            {!collapsed && (
                <div className="border-t border-border p-4">
                    <p className="text-xs text-text-muted">
                        © 2024 Store
                    </p>
                </div>
            )}
        </aside>
    );
}

/**
 * Mobile sidebar navigation (used in Sheet)
 */
export function MobileSidebar() {
    return (
        <nav className="flex flex-col gap-2 py-4">
            {sidebarItems.map((item) => (
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
        </nav>
    );
}
