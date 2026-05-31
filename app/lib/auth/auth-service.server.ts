/**
 * Auth Service (Server-side only)
 * 
 * Handles user authentication operations via Supabase Auth.
 * Requirements: 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4
 */

import { getSupabaseAuth } from "~/lib/supabase";
import type { AuthResult, Session, User } from "./types";
import { validateEmail, validatePassword, createAuthError } from "./auth.server";

/**
 * Register a new user
 * Requirements 3.2: Create user account via Supabase Auth
 * Requirements 3.3: Redirect to homepage with logged-in session on success
 * Requirements 3.4: Display error for existing email
 * Requirements 3.5: Display password requirements
 * 
 * @param email - User email
 * @param password - User password
 * @returns AuthResult with user and session on success, or error on failure
 */
export async function registerUser(
    email: string,
    password: string
): Promise<AuthResult> {
    // Validate email format
    if (!validateEmail(email)) {
        return {
            user: null,
            session: null,
            error: createAuthError("INVALID_CREDENTIALS", "请输入有效的邮箱地址"),
        };
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return {
            user: null,
            session: null,
            error: createAuthError("WEAK_PASSWORD", passwordValidation.errors.join("; ")),
        };
    }

    try {
        const auth = getSupabaseAuth();
        const { data, error } = await auth.signUp({
            email,
            password,
        });

        if (error) {
            // Map Supabase error to our error types
            if (error.message.includes("already registered") ||
                error.message.includes("User already registered")) {
                return {
                    user: null,
                    session: null,
                    error: createAuthError("EMAIL_EXISTS"),
                };
            }

            if (error.message.includes("password")) {
                return {
                    user: null,
                    session: null,
                    error: createAuthError("WEAK_PASSWORD"),
                };
            }

            return {
                user: null,
                session: null,
                error: createAuthError("SERVER_ERROR", error.message),
            };
        }

        if (!data.user || !data.session) {
            // This can happen if email confirmation is required
            return {
                user: null,
                session: null,
                error: createAuthError("SERVER_ERROR", "注册成功，请检查邮箱确认账户"),
            };
        }

        // Map Supabase user to our User type
        const user: User = {
            id: data.user.id,
            email: data.user.email || email,
            created_at: data.user.created_at || new Date().toISOString(),
        };

        // Map Supabase session to our Session type
        const session: Session = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
            user,
        };

        return {
            user,
            session,
            error: null,
        };
    } catch (err) {
        console.error("Registration error:", err);
        return {
            user: null,
            session: null,
            error: createAuthError("NETWORK_ERROR"),
        };
    }
}

/**
 * Login an existing user
 * Requirements 4.2: Authenticate via Supabase Auth and create session
 * Requirements 4.3: Redirect to previous page or homepage on success
 * Requirements 4.4: Display error for invalid credentials
 * 
 * @param email - User email
 * @param password - User password
 * @returns AuthResult with user and session on success, or error on failure
 */
export async function loginUser(
    email: string,
    password: string
): Promise<AuthResult> {
    // Validate email format
    if (!validateEmail(email)) {
        return {
            user: null,
            session: null,
            error: createAuthError("INVALID_CREDENTIALS"),
        };
    }

    try {
        const auth = getSupabaseAuth();
        const { data, error } = await auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            // Map Supabase error to our error types
            if (error.message.includes("Invalid login credentials") ||
                error.message.includes("invalid_credentials")) {
                return {
                    user: null,
                    session: null,
                    error: createAuthError("INVALID_CREDENTIALS"),
                };
            }

            return {
                user: null,
                session: null,
                error: createAuthError("SERVER_ERROR", error.message),
            };
        }

        if (!data.user || !data.session) {
            return {
                user: null,
                session: null,
                error: createAuthError("INVALID_CREDENTIALS"),
            };
        }

        // Map Supabase user to our User type
        const user: User = {
            id: data.user.id,
            email: data.user.email || email,
            created_at: data.user.created_at || new Date().toISOString(),
        };

        // Map Supabase session to our Session type
        const session: Session = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || Math.floor(Date.now() / 1000) + 3600,
            user,
        };

        return {
            user,
            session,
            error: null,
        };
    } catch (err) {
        console.error("Login error:", err);
        return {
            user: null,
            session: null,
            error: createAuthError("NETWORK_ERROR"),
        };
    }
}

/**
 * Logout user (server-side cleanup)
 * Requirements 5.1: Terminate session via Supabase Auth
 * 
 * @param accessToken - Current access token to invalidate
 */
export async function logoutUser(accessToken?: string): Promise<void> {
    if (!accessToken) {
        return;
    }

    try {
        const auth = getSupabaseAuth();
        // Sign out from Supabase (invalidates the token)
        await auth.signOut();
    } catch (err) {
        // Log but don't throw - we'll clear cookies regardless
        console.error("Logout error:", err);
    }
}
