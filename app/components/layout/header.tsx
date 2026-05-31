import { Link, NavLink } from "react-router";
import { Menu } from "lucide-react";
import { ThemeToggle } from "../theme-toggle";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { CartIcon } from "../cart/cart-icon";
import { UserMenu, type UserMenuInfo } from "../auth";
import type { StoreSection } from "~/lib/sections";

interface NavItem {
    label: string;
    href: string;
}

// Fallback nav items when sections are not loaded
const defaultNavItems: NavItem[] = [
    { label: "应用", href: "/apps" },
    { label: "游戏", href: "/games" },
    { label: "商店", href: "/store" },
    { label: "海外代购", href: "/overseas" },
];

interface HeaderProps {
    cartItemCount?: number;
    user?: UserMenuInfo;
    sections?: StoreSection[];
    onMenuClick?: () => void;
}

/**
 * Header component with navigation, cart icon, and user menu
 * Requirements 1.1: Navigation to different store sections
 * Requirements 4.1: Cart icon showing item count
 * Requirements 4.5: Display account status in header
 */
export function Header({ cartItemCount = 0, user, sections, onMenuClick }: HeaderProps) {
    // Default to not logged in if user prop is not provided
    const userInfo: UserMenuInfo = user ?? { isLoggedIn: false };

    // Convert sections to nav items, fallback to default if no sections
    const navItems: NavItem[] = sections && sections.length > 0
        ? sections.map((section) => ({
            label: section.name,
            href: `/${section.slug}`,
        }))
        : defaultNavItems;

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/60">
            <div className="container mx-auto flex h-14 items-center px-4">
                {/* Mobile menu button */}
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            aria-label="打开菜单"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] bg-bg">
                        <nav className="flex flex-col gap-4 pt-8">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.href}
                                    to={item.href}
                                    className={({ isActive }) =>
                                        `text-lg font-medium transition-colors hover:text-accent ${isActive ? "text-accent" : "text-text-primary"
                                        }`
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>

                {/* Logo */}
                <Link to="/" className="flex items-center gap-2 mr-6">
                    <img src="/logo.svg" alt="Gisyit Shop" className="h-8 w-auto" />
                </Link>

                {/* Desktop navigation */}
                <nav className="hidden md:flex items-center gap-6 flex-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.href}
                            to={item.href}
                            className={({ isActive }) =>
                                `text-sm font-medium transition-colors hover:text-accent ${isActive ? "text-accent" : "text-text-secondary"
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Right side actions */}
                <div className="flex items-center gap-2 ml-auto">
                    <ThemeToggle />
                    <UserMenu user={userInfo} />
                    <CartIcon itemCount={cartItemCount} />
                </div>
            </div>
        </header>
    );
}
