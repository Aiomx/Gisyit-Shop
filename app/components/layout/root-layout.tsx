"use client";

import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { motion } from "motion/react";
import { ToastProvider, setToastFunction, useToast } from "~/components/ui/toast";
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
    IconBrain,
    IconSparkles,
    IconCpu,
    IconRobot,
    IconBolt,
    IconTag,
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
import type { StoreSection } from "~/lib/sections";

interface RootLayoutProps {
    children: React.ReactNode;
    cartItemCount?: number;
    user?: UserMenuInfo;
    sections?: StoreSection[];
    hideSidebar?: boolean;
    hideFooter?: boolean;
}

// Icon mapping for dynamic sections
const sectionIconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    brain: IconBrain,
    "app-window": IconApps,
    "gamepad-2": IconDeviceGamepad2,
    "shopping-bag": IconShoppingBag,
    globe: IconWorld,
    sparkles: IconSparkles,
    cpu: IconCpu,
    bot: IconRobot,
    zap: IconBolt,
};

// Default navigation links (fallback)
const defaultNavLinks = [
    { label: "应用", href: "/apps", icon: "app-window" },
    { label: "游戏", href: "/games", icon: "gamepad-2" },
    { label: "商店", href: "/store", icon: "shopping-bag" },
    { label: "海外代购", href: "/overseas", icon: "globe" },
];

function getSectionIcon(iconName?: string) {
    const IconComponent = sectionIconComponents[iconName || ""] || IconShoppingBag;
    return <IconComponent className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />;
}

/**
 * Root Layout with Aceternity Sidebar
 * Features rounded inner content area
 */
export function RootLayout({
    children,
    cartItemCount = 0,
    user,
    sections,
    hideSidebar = false,
}: RootLayoutProps) {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    // Build navigation links from sections or use defaults
    const sectionNavLinks = sections && sections.length > 0
        ? sections.map((section) => ({
            label: section.name,
            href: `/${section.slug}`,
            icon: getSectionIcon(section.icon),
        }))
        : defaultNavLinks.map((link) => ({
            label: link.label,
            href: link.href,
            icon: getSectionIcon(link.icon),
        }));

    // Navigation links with home
    const navLinks = [
        {
            label: "首页",
            href: "/",
            icon: <IconHome className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
        ...sectionNavLinks,
        {
            label: "品牌专栏",
            href: "/brands",
            icon: <IconTag className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
        },
    ];

    // User action links
    const userLinks = user?.isLoggedIn
        ? [
            {
                label: "个人资料",
                href: "/account/profile",
                icon: <IconUser className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
            },
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
        <ToastProvider>
            <ToastInitializer />
            <div
                className={cn(
                    "flex h-screen w-full flex-col overflow-hidden bg-neutral-100 md:flex-row dark:bg-neutral-900"
                )}
            >
                {!hideSidebar && (
                    <Sidebar open={open} setOpen={setOpen}>
                        <SidebarBody className="justify-between gap-10">
                            <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                                {open ? <Logo /> : <LogoIcon />}

                                {/* Main Navigation */}
                                <div className="mt-8 flex flex-col gap-2">
                                    {navLinks.map((link) => (
                                        <SidebarNavLink
                                            key={link.href}
                                            link={link}
                                            isActive={
                                                location.pathname === link.href ||
                                                (link.href !== "/" && location.pathname.startsWith(link.href))
                                            }
                                        />
                                    ))}
                                </div>

                                {/* User Links */}
                                {userLinks.length > 0 && (
                                    <div className="mt-8 flex flex-col gap-2 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                                        {userLinks.map((link) => (
                                            <SidebarNavLink
                                                key={link.href}
                                                link={link}
                                                isActive={location.pathname.startsWith(link.href)}
                                            />
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
                                                href: "/account/profile",
                                                icon: (
                                                    <div className="h-7 w-7 shrink-0 rounded-full bg-accent/20 flex items-center justify-center">
                                                        <IconUser className="h-4 w-4 text-accent" />
                                                    </div>
                                                ),
                                            }}
                                        />
                                        <form action="/auth/logout" method="post">
                                            <button
                                                type="submit"
                                                className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left"
                                            >
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
                                            icon: (
                                                <IconLogin className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
                                            ),
                                        }}
                                        isActive={location.pathname === "/auth/login"}
                                    />
                                )}
                            </div>
                        </SidebarBody>
                    </Sidebar>
                )}

                {/* Main Content Area with rounded corners */}
                <MainContent hideSidebar={hideSidebar}>{children}</MainContent>
            </div>
        </ToastProvider>
    );
}

/**
 * Toast Initializer - Sets up the global toast function
 */
function ToastInitializer() {
    const { addToast } = useToast();

    useEffect(() => {
        setToastFunction(addToast);
    }, [addToast]);

    return null;
}


/**
 * Logo Component - Expanded state (full logo with Store text)
 */
const Logo = () => {
    return (
        <Link
            to="/"
            className="relative z-20 flex items-center gap-3 py-2"
        >
            <motion.div
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
            >
                <img src="/logo.svg" alt="Gisyit Shop" className="h-10 w-auto" />
            </motion.div>
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="font-semibold text-xl whitespace-pre text-black dark:text-white"
            >
                Shop
            </motion.span>
        </Link>
    );
};

/**
 * Logo Icon - Collapsed state (syit icon with flip animation)
 */
const LogoIcon = () => {
    return (
        <Link
            to="/"
            className="relative z-20 flex items-center justify-center py-2"
        >
            <motion.div
                initial={{ rotateY: -180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ transformStyle: "preserve-3d" }}
                className="flex items-center justify-center"
            >
                <img src="/syit.svg" alt="Syit" className="h-8 w-8 object-contain" />
            </motion.div>
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
function MainContent({
    children,
    hideSidebar,
}: {
    children: React.ReactNode;
    hideSidebar?: boolean;
}) {
    return (
        <div className="flex flex-1 overflow-hidden">
            <div
                className={cn(
                    "flex h-full w-full flex-1 flex-col border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800 overflow-auto",
                    !hideSidebar && "rounded-tl-2xl"
                )}
            >
                <div className="flex-1 p-4 md:p-6 lg:p-8">{children}</div>
            </div>
        </div>
    );
}

export default RootLayout;
