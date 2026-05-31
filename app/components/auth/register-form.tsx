/**
 * Registration Form Component
 * 
 * Form for user registration with email and password.
 * Requirements: 3.1, 3.5
 */

import { Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PASSWORD_REQUIREMENTS } from "~/lib/auth";

interface RegisterFormProps {
    error?: string | null;
    fieldErrors?: {
        email?: string;
        password?: string;
    };
}

/**
 * RegisterForm - User registration form
 * Requirements 3.1: Display registration form with email and password fields
 * Requirements 3.5: Display password requirements
 */
export function RegisterForm({ error, fieldErrors }: RegisterFormProps) {
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <Form method="post" className="space-y-6">
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
                    autoComplete="new-password"
                    required
                    placeholder="••••••••"
                    aria-describedby="password-requirements"
                    className={fieldErrors?.password ? "border-destructive" : ""}
                />
                {fieldErrors?.password ? (
                    <p className="text-sm text-destructive">
                        {fieldErrors.password}
                    </p>
                ) : (
                    <p id="password-requirements" className="text-xs text-text-muted">
                        至少 {PASSWORD_REQUIREMENTS.minLength} 位，包含字母和数字
                    </p>
                )}
            </div>

            {/* Submit button */}
            <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
            >
                {isSubmitting ? "注册中..." : "注册"}
            </Button>

            {/* Login link */}
            <p className="text-center text-sm text-text-secondary">
                已有账户？{" "}
                <Link
                    to="/auth/login"
                    className="text-accent hover:underline"
                >
                    立即登录
                </Link>
            </p>
        </Form>
    );
}
