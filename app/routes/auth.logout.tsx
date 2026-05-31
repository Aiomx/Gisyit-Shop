/**
 * Logout Route
 * 
 * Handles user logout by terminating session and clearing cookies.
 * Requirements: 5.1, 5.2, 5.3
 * - 5.1: Terminate session via Supabase Auth
 * - 5.2: Redirect to homepage after logout
 * - 5.3: Clear all session-related data from cookies
 */

import type { Route } from "./+types/auth.logout";

/**
 * Logout Action
 * Requirements 5.1: Terminate session via Supabase Auth
 * Requirements 5.2: Redirect to homepage
 * Requirements 5.3: Clear all session-related data from cookies
 */
export async function action({ request }: Route.ActionArgs) {
    const {
        destroyUserSession,
        getUserSession,
        logoutUser,
    } = await import("~/lib/auth/index.server");

    // Get current session to invalidate on Supabase side
    const sessionCookie = await getUserSession(request);

    // Terminate session on Supabase Auth (Requirements 5.1)
    if (sessionCookie?.access_token) {
        await logoutUser(sessionCookie.access_token);
    }

    // Clear cookies and redirect to homepage (Requirements 5.2, 5.3)
    return destroyUserSession(request, "/");
}

/**
 * Loader - redirect GET requests to homepage
 * Logout should only be triggered via POST for security
 */
export async function loader() {
    // Redirect GET requests to homepage
    return new Response(null, {
        status: 302,
        headers: {
            Location: "/",
        },
    });
}
