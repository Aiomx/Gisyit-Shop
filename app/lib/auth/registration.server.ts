/**
 * User Registration (Server-side only)
 *
 * Handles user registration via Supabase Auth.
 * Creates user account and returns session.
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */

import type { Session, AuthError, AuthErrorCode } from "./types";

// ============================================
// Registration Types
// ============================================

export interface RegistrationResult {
    success: boolean;
    session: Session | null;
    error: AuthError | null;
}

// ============================================
// Supabase Auth Integration
// ============================================

/**
 * Register a new user via Supabase Auth
 *
 * Requirements:
 * - 3.2: Create user account via Supabase Auth
 * - 3.3: Return valid session on success
 * - 3.4: Handle existing email error
 * - 3.5: Handle weak password error
 *
 * @param email - User's email address
 * @param password - User's password
 * @returns Registration result with session or error
 */
export async function registerUser(
    email: string,
    password: string
): Promise<RegistrationResult> {
    try {
        // Get Supabase URL and anon key from environment
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("Missing Supabase configuration");
            return {
                success: false,
                session: null,
                error: {
                    code: "SERVER_ERROR",
                    message: "服务器配置错误，请稍后重试",
                },
            };
        }

        // Call Supabase Auth signup endpoint
        const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: supabaseAnonKey,
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const data = await response.json();

        // Handle error responses
        if (!response.ok) {
            return handleSupabaseError(data);
        }

        // Check if email confirmation is required
        // Supabase returns user but no session if email confirmation is enabled
        if (!data.access_token) {
            // Email confirmation required
            return {
                success: true,
                session: null,
                error: null,
            };
        }

        // Build session from response (Requirements 3.3)
        const session: Session = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at || Math.floor(Date.now() / 1000) + 3600,
            user: {
                id: data.user?.id || "",
                email: data.user?.email || email,
                created_at: data.user?.created_at || new Date().toISOString(),
            },
        };

        return {
            success: true,
            session,
            error: null,
        };
    } catch (error) {
        console.error("Registration error:", error);
        return {
            success: false,
            session: null,
            error: {
                code: "NETWORK_ERROR",
                message: "网络连接失败，请稍后重试",
            },
        };
    }
}

/**
 * Handle Supabase Auth error responses
 * Maps Supabase errors to user-friendly messages
 *
 * Requirements: 3.4, 3.5
 */
function handleSupabaseError(data: {
    error?: string;
    error_description?: string;
    msg?: string;
    message?: string;
}): RegistrationResult {
    const errorMessage =
        data.error_description || data.msg || data.message || data.error || "";
    const lowerMessage = errorMessage.toLowerCase();

    // Check for existing email (Requirements 3.4)
    if (
        lowerMessage.includes("already registered") ||
        lowerMessage.includes("already exists") ||
        lowerMessage.includes("user already")
    ) {
        return {
            success: false,
            session: null,
            error: {
                code: "EMAIL_EXISTS",
                message: "该邮箱已被注册",
            },
        };
    }

    // Check for weak password (Requirements 3.5)
    if (
        lowerMessage.includes("password") &&
        (lowerMessage.includes("weak") ||
            lowerMessage.includes("short") ||
            lowerMessage.includes("length") ||
            lowerMessage.includes("at least"))
    ) {
        return {
            success: false,
            session: null,
            error: {
                code: "WEAK_PASSWORD",
                message: "密码强度不足，请使用至少 8 位包含字母和数字的密码",
            },
        };
    }

    // Check for invalid email
    if (lowerMessage.includes("email") && lowerMessage.includes("invalid")) {
        return {
            success: false,
            session: null,
            error: {
                code: "INVALID_CREDENTIALS",
                message: "请输入有效的邮箱地址",
            },
        };
    }

    // Generic error
    return {
        success: false,
        session: null,
        error: {
            code: "SERVER_ERROR",
            message: errorMessage || "注册失败，请稍后重试",
        },
    };
}
