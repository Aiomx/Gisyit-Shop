/**
 * Login Page Route
 * 
 * User login with email and password.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3
 */

import type { Route } from "./+types/auth.login";
import { AuthLayout, LoginForm } from "~/components/auth";

/**
 * Login Action
 * Requirements 4.2: Authenticate via Supabase Auth and create session
 * Requirements 4.3: Redirect to previous page or homepage
 * Requirements 4.4: Display error for invalid credentials
 * Requirements 6.1, 6.2, 6.3: Merge anonymous cart on login
 */
export async function action({ request }: Route.ActionArgs) {
    const {
        loginUser,
        createUserSession,
        validateEmail,
    } = await import("~/lib/auth/index.server");
    const { parseCartSession } = await import("~/lib/cart/session.server");
    const { handleCartMergeOnLogin } = await import("~/lib/cart/cart-merge.server");

    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const redirectTo = (formData.get("redirectTo") as string) || "/";

    // Validate inputs
    const fieldErrors: { email?: string; password?: string } = {};

    if (!email) {
        fieldErrors.email = "请输入邮箱";
    } else if (!validateEmail(email)) {
        fieldErrors.email = "请输入有效的邮箱地址";
    }

    if (!password) {
        fieldErrors.password = "请输入密码";
    }

    // Return field errors if any
    if (Object.keys(fieldErrors).length > 0) {
        return Response.json(
            { error: null, fieldErrors },
            { status: 400 }
        );
    }

    // Attempt login
    const result = await loginUser(email, password);

    if (result.error) {
        // Requirements 4.4: Display error for invalid credentials
        if (result.error.code === "INVALID_CREDENTIALS") {
            return Response.json(
                { error: result.error.message, fieldErrors: {} },
                { status: 400 }
            );
        }

        return Response.json(
            { error: result.error.message, fieldErrors: {} },
            { status: 400 }
        );
    }

    // Login successful - handle cart merge before creating session
    // Requirements 6.1, 6.2, 6.3: Merge anonymous cart on login
    if (result.session && result.user) {
        // Get anonymous session ID from cart cookie
        const cookieHeader = request.headers.get("Cookie");
        const cartSession = parseCartSession(cookieHeader);

        if (cartSession?.sessionId) {
            // Attempt to merge anonymous cart into user cart
            // This is a best-effort operation - login should succeed even if merge fails
            try {
                const mergeResult = await handleCartMergeOnLogin(
                    result.user.id,
                    cartSession.sessionId
                );

                if (mergeResult.error) {
                    // Log the error but don't fail the login
                    console.warn("Cart merge warning:", mergeResult.error);
                } else if (mergeResult.merged) {
                    console.log(
                        `Cart merged: ${mergeResult.itemsMerged} items, ${mergeResult.duplicatesHandled} duplicates combined`
                    );
                }
            } catch (error) {
                // Log but don't fail login
                console.error("Cart merge error:", error);
            }
        }

        // Create session and redirect
        // Requirements 4.3: Redirect to previous page or homepage
        return createUserSession(result.session, redirectTo);
    }

    // Fallback error
    return Response.json(
        { error: "登录失败，请稍后重试", fieldErrors: {} },
        { status: 500 }
    );
}

/**
 * Loader to get redirect URL from query params
 */
export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get("redirectTo") || "/";
    return { redirectTo };
}

export function meta() {
    return [
        { title: "登录 - Gisyit Shop" },
        { name: "description", content: "登录 Store 账户" },
    ];
}

/**
 * Login Page Component
 * Requirements 4.1: Display login form with email and password fields
 */
export default function LoginRoute({ actionData, loaderData }: Route.ComponentProps) {
    const data = actionData as {
        error?: string | null;
        fieldErrors?: { email?: string; password?: string }
    } | undefined;

    return (
        <AuthLayout
            title="登录"
            description="登录后可查看订单历史和保存购物车"
        >
            <LoginForm
                error={data?.error}
                fieldErrors={data?.fieldErrors}
                redirectTo={loaderData?.redirectTo}
            />
        </AuthLayout>
    );
}
