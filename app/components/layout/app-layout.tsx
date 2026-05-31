"use client";

import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import {
    IconHome,
    IconApps,
    IconDeviceGamepad2,
    IconShoppingBag,
    IconWorld,
    IconShoppingCart,
    IconUser,
    IconLogout,
    IconLogin,
    IconSettings,
    IconSun,
    IconMoon,
} from "@tabler/icons-react";
import {
    Sidebar,
    SidebarBody,
    SidebarLink,
    useSidebar,
} from "~/components/ui/aceternity-sidebar";
import { cn } from "~/lib/utils";
import { useTheme } from "~/lib/theme";
import type { UserMenuInfo } from "~/components/auth";

interface AppLayoutProps {
    children: React.ReactNode;
    user?: UserMenuInfo;
    cartItemCount?: number;
}

/**
 * App Layout with Aceternity Sidebar
 * Features rounded inner content area like the reference image
 */
export function AppLayout({ children, user, cartItemCount = 0 }: AppLayoutProps) {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    // Navigation links
    const navLinks = [
        {
            label: "首页",
            href: "/",
            icon: <IconHome className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
        {
            label: "应用",
            href: "/apps",
            icon: <IconApps className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
        {
            label: "游戏",
            href: "/games",
            icon: <IconDeviceGamepad2 className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
        {
            label: "商店",
            href: "/store",
            icon: <IconShoppingBag className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
        {
            label: "海外代购",
            href: "/overseas",
            icon: <IconWorld className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
    ];

    // User action links
    const userLinks = user?.isLoggedIn
        ? [
            {
                label: "我的订单",
                href: "/account/orders",
                icon: <IconShoppingBag className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
            },
            {
                label: "账户设置",
                href: "/account",
                icon: <IconSettings className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
            },
        ]
        : [];

    return (
        <div
            className={cn(
                "flex h-screen w-full flex-col overflow-hidden bg-neutral-100 md:flex-row dark:bg-neutral-900"
            )}
        >
            <Sidebar open={open} setOpen={setOpen}>
                <SidebarBody className="justify-between gap-10">
                    <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                        {open ? <Logo /> : <LogoIcon />}

                        {/* Main Navigation */}
                        <div className="mt-8 flex flex-col gap-2">
                            {navLinks.map((link) => (
                                <SidebarNavLink key={link.href} link={link} isActive={location.pathname === link.href || (link.href !== "/" && location.pathname.startsWith(link.href))} />
                            ))}
                        </div>

                        {/* User Links */}
                        {userLinks.length > 0 && (
                            <div className="mt-8 flex flex-col gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                {userLinks.map((link) => (
                                    <SidebarNavLink key={link.href} link={link} isActive={location.pathname.startsWith(link.href)} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bottom Section - Cart, Theme, User */}
                    <div className="flex flex-col gap-2">
                        {/* Cart Link */}
                        <SidebarNavLink
                            link={{
                                label: `购物车${cartItemCount > 0 ? ` (${cartItemCount})` : ""}`,
                                href: "/cart",
                                icon: (
                                    <div className="relative">
                                        <IconShoppingCart className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                                        {cartItemCount > 0 && (
                                            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[10px] font-medium text-white flex items-center justify-center">
                                                {cartItemCount > 99 ? "99+" : cartItemCount}
                                            </span>
                                        )}
                                    </div>
                                ),
                            }}
                            isActive={location.pathname === "/cart"}
                        />

                        {/* Theme Toggle */}
                        <ThemeToggleLink open={open} />

                        {/* User Section */}
                        {user?.isLoggedIn ? (
                            <div className="flex flex-col gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-2">
                                <SidebarLink
                                    link={{
                                        label: user.email || "用户",
                                        href: "/account",
                                        icon: (
                                            <div className="h-7 w-7 shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
                                                <IconUser className="h-4 w-4 text-accent" />
                                            </div>
                                        ),
                                    }}
                                />
                                <form action="/auth/logout" method="post">
                                    <button type="submit" className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left">
                                        <IconLogout className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                                        <motion.span
                                            animate={{
                                                display: open ? "inline-block" : "none",
                                                opacity: open ? 1 : 0,
                                            }}
                                            className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                                        >
                                            退出登录
                                        </motion.span>
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <SidebarNavLink
                                link={{
                                    label: "登录",
                                    href: "/auth/login",
                                    icon: <IconLogin className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
                                }}
                                isActive={location.pathname === "/auth/login"}
                            />
                        )}
                    </div>
                </SidebarBody>
            </Sidebar>

            {/* Main Content Area with rounded corners */}
            <MainContent>{children}</MainContent>
        </div>
    );
}


/**
 * Logo Component - Expanded state
 */
const Logo = () => {
    return (
        <Link
            to="/"
            className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
        >
            <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-accent" />
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-semibold text-lg whitespace-pre text-black dark:text-white"
            >
                Store
            </motion.span>
        </Link>
    );
};

/**
 * Logo Icon - Collapsed state
 */
const LogoIcon = () => {
    return (
        <Link
            to="/"
            className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
        >
            <div className="h-6 w-7 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-accent" />
        </Link>
    );
};

/**
 * Sidebar Navigation Link with active state
 */
function SidebarNavLink({
    link,
    isActive,
}: {
    link: { label: string; href: string; icon: React.ReactNode };
    isActive?: boolean;
}) {
    const { open, animate } = useSidebar();

    return (
        <NavLink
            to={link.href}
            className={cn(
                "flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg transition-colors",
                isActive
                    ? "bg-accent/10 text-accent"
                    : "hover:bg-neutral-200 dark:hover:bg-neutral-700"
            )}
        >
            <span className={isActive ? "text-accent" : ""}>{link.icon}</span>
            <motion.span
                animate={{
                    display: animate ? (open ? "inline-block" : "none") : "inline-block",
                    opacity: animate ? (open ? 1 : 0) : 1,
                }}
                className={cn(
                    "text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0",
                    isActive
                        ? "text-accent font-medium"
                        : "text-neutral-700 dark:text-neutral-200"
                )}
            >
                {link.label}
            </motion.span>
        </NavLink>
    );
}

/**
 * Theme Toggle Link
 */
function ThemeToggleLink({ open }: { open: boolean }) {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <button
            onClick={toggleTheme}
            className="flex items-center justify-start gap-2 group/sidebar py-2 px-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors w-full text-left"
        >
            {theme === "dark" ? (
                <IconSun className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            ) : (
                <IconMoon className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
            )}
            <motion.span
                animate={{
                    display: open ? "inline-block" : "none",
                    opacity: open ? 1 : 0,
                }}
                className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
            >
                {theme === "dark" ? "浅色模式" : "深色模式"}
            </motion.span>
        </button>
    );
}

/**
 * Main Content Area with rounded corners
 */
function MainContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-1 overflow-hidden">
            <div className="flex h-full w-full flex-1 flex-col rounded-tl-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-auto">
                <div className="flex-1 p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default AppLayout;
