/**
 * Registration Page Route
 * 
 * User registration with email and password.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { Route } from "./+types/auth.register";
import { AuthLayout, RegisterForm } from "~/components/auth";

/**
 * Registration Action
 * Requirements 3.2: Create user account via Supabase Auth
 * Requirements 3.3: Redirect to homepage with logged-in session
 * Requirements 3.4: Display error for existing email
 * Requirements 3.5: Display password requirements
 */
export async function action({ request }: Route.ActionArgs) {
    const {
        registerUser,
        createUserSession,
        validateEmail,
        validatePassword,
    } = await import("~/lib/auth/index.server");

    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Validate inputs
    const fieldErrors: { email?: string; password?: string } = {};

    if (!email) {
        fieldErrors.email = "请输入邮箱";
    } else if (!validateEmail(email)) {
        fieldErrors.email = "请输入有效的邮箱地址";
    }

    if (!password) {
        fieldErrors.password = "请输入密码";
    } else {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            fieldErrors.password = passwordValidation.errors[0];
        }
    }

    // Return field errors if any
    if (Object.keys(fieldErrors).length > 0) {
        return Response.json(
            { error: null, fieldErrors },
            { status: 400 }
        );
    }

    // Attempt registration
    const result = await registerUser(email, password);

    if (result.error) {
        // Map error to field-specific or global error
        if (result.error.code === "EMAIL_EXISTS") {
            return Response.json(
                { error: null, fieldErrors: { email: result.error.message } },
                { status: 400 }
            );
        }

        if (result.error.code === "WEAK_PASSWORD") {
            return Response.json(
                { error: null, fieldErrors: { password: result.error.message } },
                { status: 400 }
            );
        }

        return Response.json(
            { error: result.error.message, fieldErrors: {} },
            { status: 400 }
        );
    }

    // Registration successful - create session and redirect
    if (result.session) {
        return createUserSession(result.session, "/");
    }

    // Fallback error
    return Response.json(
        { error: "注册失败，请稍后重试", fieldErrors: {} },
        { status: 500 }
    );
}

export function meta() {
    return [
        { title: "注册 - Gisyit Shop" },
        { name: "description", content: "创建 Store 账户" },
    ];
}

/**
 * Registration Page Component
 * Requirements 3.1: Display registration form with email and password fields
 */
export default function RegisterRoute({ actionData }: Route.ComponentProps) {
    const data = actionData as {
        error?: string | null;
        fieldErrors?: { email?: string; password?: string }
    } | undefined;

    return (
        <AuthLayout
            title="创建账户"
            description="注册后可保存购物车和查看订单历史"
        >
            <RegisterForm
                error={data?.error}
                fieldErrors={data?.fieldErrors}
            />
        </AuthLayout>
    );
}
