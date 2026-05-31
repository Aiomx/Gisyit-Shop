/**
 * Login Form Component
 * 
 * Form for user login with email and password.
 * Requirements: 4.1, 4.4
 */

import { Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface LoginFormProps {
    error?: string | null;
    fieldErrors?: {
        email?: string;
        password?: string;
    };
    redirectTo?: string;
}

/**
 * LoginForm - User login form
 * Requirements 4.1: Display login form with email and password fields
 * Requirements 4.4: Display error for invalid credentials
 */
export function LoginForm({ error, fieldErrors, redirectTo }: LoginFormProps) {
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <Form method="post" className="space-y-6">
            {/* Hidden redirect field */}
            {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
            )}

            {/* Global error message */}
            {error && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    {error}
                </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
                <Label htmlFor="email" className="text-text-primary">
                    邮箱
                </Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="your@email.com"
                    aria-describedby={fieldErrors?.email ? "email-error" : undefined}
                    className={fieldErrors?.email ? "border-destructive" : ""}
                />
                {fieldErrors?.email && (
                    <p id="email-error" className="text-sm text-destructive">
                        {fieldErrors.email}
                    </p>
                )}
            </div>

            {/* Password field */}
            <div className="space-y-2">
                <Label htmlFor="password" className="text-text-primary">
                    密码
                </Label>
                <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    aria-describedby={fieldErrors?.password ? "password-error" : undefined}
                    className={fieldErrors?.password ? "border-destructive" : ""}
                />
                {fieldErrors?.password && (
                    <p id="password-error" className="text-sm text-destructive">
                        {fieldErrors.password}
                    </p>
                )}
            </div>

            {/* Submit button */}
            <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
            >
                {isSubmitting ? "登录中..." : "登录"}
            </Button>

            {/* Register link */}
            <p className="text-center text-sm text-text-secondary">
                还没有账户？{" "}
                <Link
                    to="/auth/register"
                    className="text-accent hover:underline"
                >
                    立即注册
                </Link>
            </p>
        </Form>
    );
}
