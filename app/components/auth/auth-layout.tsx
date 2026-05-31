/**
 * Auth Layout Component
 *
 * Two-column layout for authentication pages (login, register).
 * Left side: Video background
 * Right side: Auth form in Card component
 */

import { Link, useNavigate } from "react-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface AuthLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
}

/**
 * AuthLayout - Two-column layout for auth pages
 * Left: Video background
 * Right: Card with auth form
 */
export function AuthLayout({ children, title, description }: AuthLayoutProps) {
    const navigate = useNavigate();

    const handleSkip = () => {
        navigate("/");
    };

    return (
        <div className="min-h-screen flex">
            {/* Left side - Video */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-black">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                >
                    <source src="/mp4/media.mp4" type="video/mp4" />
                </video>
                {/* Overlay for better contrast */}
                <div className="absolute inset-0 bg-black/30" />

                {/* Logo on video side */}
                <div className="absolute top-8 left-8 z-10">
                    <Link
                        to="/"
                        className="flex items-center space-x-2"
                    >
                        <div className="h-8 w-9 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-accent" />
                        <span className="font-semibold text-2xl text-white">
                            Store
                        </span>
                    </Link>
                </div>
            </div>

            {/* Right side - Auth Form */}
            <div className="w-full lg:w-1/2 bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center p-4 md:p-8">
                {/* Mobile Logo */}
                <Link
                    to="/"
                    className="flex lg:hidden items-center space-x-2 mb-8"
                >
                    <div className="h-8 w-9 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-accent" />
                    <span className="font-semibold text-2xl text-black dark:text-white">
                        Store
                    </span>
                </Link>

                {/* Auth Card */}
                <Card className="w-full max-w-md">
                    <CardHeader>
                        {title && <CardTitle className="text-2xl text-center">{title}</CardTitle>}
                        {description && (
                            <CardDescription className="text-center">
                                {description}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        {children}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            variant="ghost"
                            className="w-full text-text-secondary hover:text-text-primary"
                            onClick={handleSkip}
                        >
                            暂时跳过
                        </Button>
                    </CardFooter>
                </Card>

                {/* Footer */}
                <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
                    © 2025 Store. All rights reserved.
                </p>
            </div>
        </div>
    );
}
