/**
 * UserMenu Component
 * 
 * Displays user account status in the header.
 * Shows login button for anonymous users, or user menu with logout option for logged-in users.
 * 
 * Requirements: 4.5 - Display account status in header
 */

import { Link, Form } from "react-router";
import { User, LogOut, LogIn } from "lucide-react";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * User info for display in the menu
 */
export type UserMenuInfo = {
    email: string;
    isLoggedIn: true;
} | {
    email?: undefined;
    isLoggedIn: false;
}

interface UserMenuProps {
    user: UserMenuInfo;
}

/**
 * UserMenu component
 * Requirements 4.5: Display account status in header
 * - Shows login button when not logged in
 * - Shows user email and logout option when logged in
 */
export function UserMenu({ user }: UserMenuProps) {
    if (!user.isLoggedIn) {
        return (
            <Button variant="ghost" size="icon" asChild aria-label="登录">
                <Link to="/auth/login">
                    <LogIn className="h-5 w-5" />
                </Link>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="用户菜单"
                    className="relative"
                >
                    <User className="h-5 w-5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">账户</p>
                        <p className="text-xs leading-none text-text-secondary truncate">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Form method="post" action="/auth/logout" className="w-full">
                        <button
                            type="submit"
                            className="flex w-full items-center gap-2 cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>退出登录</span>
                        </button>
                    </Form>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
