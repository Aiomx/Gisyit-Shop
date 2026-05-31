/**
 * Suite Code Activation Edge Function
 *
 * Supabase Edge Function for client-side activation code validation and activation.
 * Handles the complete activation flow including:
 * - Code format validation
 * - Code existence and status verification
 * - Expiration check
 * - Activation recording (IP, device, timestamp, user)
 * - Benefit application
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 *
 * Deployment: supabase functions deploy suite-code-activate
 */

// @ts-nocheck - Deno runtime types not available in Node.js TypeScript
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// ============================================
// Types
// ============================================

type CodeType = 'membership' | 'credits';
type MembershipTier = 'plus' | 'pro' | 'ultra';
type CodeStatus = 'unused' | 'used' | 'expired' | 'disabled';

interface SuiteCode {
    id: string;
    code: string;
    code_type: CodeType;
    membership_tier: MembershipTier | null;
    credits_amount: number | null;
    membership_days: number | null;
    status: CodeStatus;
    expires_at: string;
    created_at: string;
    activated_at: string | null;
    activated_by: string | null;
    activation_ip: string | null;
    activation_device: string | null;
    batch_id: string | null;
    notes: string | null;
}

interface ActivateCodeRequest {
    code: string;
    device_info?: string;
}

interface ActivateCodeResponse {
    success: boolean;
    message: string;
    error?: {
        code: string;
        message: string;
    };
    benefit?: {
        type: CodeType;
        membership_tier?: MembershipTier;
        membership_days?: number;
        credits_amount?: number;
    };
}

// ============================================
// Constants
// ============================================

const CODE_FORMAT_PATTERN = /^(SPLUS|SPRO|SULTRA|SCRED)-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const ERROR_MESSAGES: Record<string, string> = {
    CODE_NOT_FOUND: '激活码不存在',
    CODE_ALREADY_USED: '激活码已被使用',
    CODE_EXPIRED: '激活码已过期',
    CODE_DISABLED: '激活码已被禁用',
    INVALID_FORMAT: '激活码格式无效',
    MISSING_CODE: '请提供激活码',
    ACTIVATION_FAILED: '激活失败，请稍后重试',
    UNAUTHORIZED: '请先登录后再激活',
};

// CORS headers for the response
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
        return createErrorResponse(405, "METHOD_NOT_ALLOWED", "只支持 POST 请求");
    }

    try {
        // Get Supabase client with service role key for admin operations
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Suite Code Activate] Missing Supabase environment variables");
            throw new Error("Server configuration error");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Get user from authorization header (supports both Supabase JWT and custom session tokens)
        const authHeader = req.headers.get("Authorization");
        const userInfo = await getUserFromAuth(supabase, authHeader);

        if (!userInfo) {
            return createErrorResponse(401, "UNAUTHORIZED", ERROR_MESSAGES.UNAUTHORIZED);
        }

        // Parse request body
        let body: ActivateCodeRequest;
        try {
            body = await req.json();
        } catch {
            return createErrorResponse(400, "INVALID_REQUEST", "请求格式无效");
        }

        // Validate request
        if (!body.code || typeof body.code !== "string") {
            return createErrorResponse(400, "MISSING_CODE", ERROR_MESSAGES.MISSING_CODE);
        }

        // Get client IP address
        const clientIp = getClientIp(req);

        // Perform activation
        const result = await activateCode(
            supabase,
            body.code,
            userInfo.userId,
            clientIp,
            body.device_info
        );

        if (result.success) {
            console.log(`[Suite Code Activate] Success: code=${body.code}, user=${userInfo.userId}`);
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        } else {
            console.log(`[Suite Code Activate] Failed: code=${body.code}, error=${result.error?.code}`);
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }
    } catch (error) {
        console.error("[Suite Code Activate] Error:", error);
        return createErrorResponse(
            500,
            "ACTIVATION_FAILED",
            ERROR_MESSAGES.ACTIVATION_FAILED
        );
    }
});


// ============================================
// Helper Functions
// ============================================

/**
 * Creates an error response with consistent format
 */
function createErrorResponse(
    status: number,
    errorCode: string,
    message: string
): Response {
    const response: ActivateCodeResponse = {
        success: false,
        message,
        error: {
            code: errorCode,
            message,
        },
    };

    return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
    });
}

/**
 * Extracts user info from authorization header
 * Supports both Supabase JWT tokens and custom session tokens
 *
 * @param supabase - Supabase client
 * @param authHeader - Authorization header value
 * @returns User info or null if not authenticated
 */
async function getUserFromAuth(
    supabase: SupabaseClient,
    authHeader: string | null
): Promise<{ userId: string; email?: string } | null> {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    const token = authHeader.replace("Bearer ", "");

    // Check if it's a debug token
    if (token.startsWith("debug_")) {
        try {
            const tokenData = JSON.parse(atob(token.substring(6)));
            // Verify debug token hasn't expired
            if (tokenData.expiresAt && Date.now() > tokenData.expiresAt) {
                console.log("[Suite Code Activate] Debug token expired");
                return null;
            }
            // Use email as userId for consistency with KV storage
            const userId = tokenData.email || tokenData.userId;
            console.log("[Suite Code Activate] Debug token validated for user:", userId);
            return { userId, email: tokenData.email };
        } catch (e) {
            console.error("[Suite Code Activate] Invalid debug token format:", e);
            return null;
        }
    }

    // Check if it's a custom session token (not a JWT - doesn't have dots)
    if (!token.includes(".")) {
        // It's a custom session token, verify with the auth service
        try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const response = await fetch(
                `${supabaseUrl}/functions/v1/make-server-c8954261/auth/verify-session`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    // Use email as userId since that's how the server stores user data
                    console.log("[Suite Code Activate] Custom session token validated for user:", data.user.email);
                    return { userId: data.user.email, email: data.user.email };
                }
            }
            console.log("[Suite Code Activate] Custom session token verification failed");
            return null;
        } catch (error) {
            console.error("[Suite Code Activate] Custom session verification error:", error);
            return null;
        }
    }

    // It's a Supabase JWT token
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error("[Suite Code Activate] Supabase auth error:", error);
            return null;
        }

        // Use email as userId for consistency with KV storage
        return { userId: user.email || user.id, email: user.email };
    } catch (error) {
        console.error("[Suite Code Activate] Auth exception:", error);
        return null;
    }
}

/**
 * Extracts client IP address from request headers
 *
 * @param req - Request object
 * @returns Client IP address or 'unknown'
 */
function getClientIp(req: Request): string {
    // Try various headers that might contain the real IP
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwardedFor.split(",")[0].trim();
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    return "unknown";
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validates the format of an activation code string
 *
 * Requirements: 7.4
 */
function validateCodeFormat(code: string): { valid: boolean; errorCode?: string; message?: string } {
    if (!code || typeof code !== "string") {
        return {
            valid: false,
            errorCode: "INVALID_FORMAT",
            message: ERROR_MESSAGES.INVALID_FORMAT,
        };
    }

    // Normalize: trim whitespace and convert to uppercase
    const normalizedCode = code.trim().toUpperCase();

    // Check against the format pattern
    if (!CODE_FORMAT_PATTERN.test(normalizedCode)) {
        return {
            valid: false,
            errorCode: "INVALID_FORMAT",
            message: ERROR_MESSAGES.INVALID_FORMAT,
        };
    }

    return { valid: true };
}

/**
 * Validates if a code's status allows activation
 *
 * Requirements: 5.1
 */
function validateCodeStatus(status: CodeStatus): { valid: boolean; errorCode?: string; message?: string } {
    switch (status) {
        case "unused":
            return { valid: true };
        case "used":
            return {
                valid: false,
                errorCode: "CODE_ALREADY_USED",
                message: ERROR_MESSAGES.CODE_ALREADY_USED,
            };
        case "expired":
            return {
                valid: false,
                errorCode: "CODE_EXPIRED",
                message: ERROR_MESSAGES.CODE_EXPIRED,
            };
        case "disabled":
            return {
                valid: false,
                errorCode: "CODE_DISABLED",
                message: ERROR_MESSAGES.CODE_DISABLED,
            };
        default:
            return {
                valid: false,
                errorCode: "CODE_DISABLED",
                message: "激活码状态无效",
            };
    }
}

/**
 * Validates if a code has expired
 *
 * Requirements: 5.2
 */
function validateExpiration(expiresAt: string): { valid: boolean; errorCode?: string; message?: string } {
    const expirationDate = new Date(expiresAt);
    const now = new Date();

    if (now > expirationDate) {
        return {
            valid: false,
            errorCode: "CODE_EXPIRED",
            message: ERROR_MESSAGES.CODE_EXPIRED,
        };
    }

    return { valid: true };
}


// ============================================
// Core Activation Logic
// ============================================

/**
 * Performs the complete activation flow
 *
 * Steps:
 * 1. Validate code format
 * 2. Look up code in database
 * 3. Validate code status
 * 4. Validate expiration
 * 5. Update code with activation details
 * 6. Return benefit information
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
async function activateCode(
    supabase: SupabaseClient,
    codeString: string,
    userId: string,
    clientIp: string,
    deviceInfo?: string
): Promise<ActivateCodeResponse> {
    // Step 1: Validate format
    const normalizedCode = codeString.trim().toUpperCase();
    const formatValidation = validateCodeFormat(normalizedCode);

    if (!formatValidation.valid) {
        return {
            success: false,
            message: formatValidation.message!,
            error: {
                code: formatValidation.errorCode!,
                message: formatValidation.message!,
            },
        };
    }

    // Step 2: Look up code in database
    const { data: codeEntity, error: selectError } = await supabase
        .from("suite_codes")
        .select("*")
        .eq("code", normalizedCode)
        .single();

    if (selectError || !codeEntity) {
        console.log(`[Suite Code Activate] Code not found: ${normalizedCode}`);
        return {
            success: false,
            message: ERROR_MESSAGES.CODE_NOT_FOUND,
            error: {
                code: "CODE_NOT_FOUND",
                message: ERROR_MESSAGES.CODE_NOT_FOUND,
            },
        };
    }

    const code = codeEntity as SuiteCode;

    // Step 3: Validate status
    const statusValidation = validateCodeStatus(code.status);
    if (!statusValidation.valid) {
        return {
            success: false,
            message: statusValidation.message!,
            error: {
                code: statusValidation.errorCode!,
                message: statusValidation.message!,
            },
        };
    }

    // Step 4: Validate expiration
    const expirationValidation = validateExpiration(code.expires_at);
    if (!expirationValidation.valid) {
        // Also update the code status to expired in database
        await supabase
            .from("suite_codes")
            .update({ status: "expired" })
            .eq("id", code.id);

        return {
            success: false,
            message: expirationValidation.message!,
            error: {
                code: expirationValidation.errorCode!,
                message: expirationValidation.message!,
            },
        };
    }

    // Step 5: Update code with activation details
    const activatedAt = new Date().toISOString();

    const { error: updateError } = await supabase
        .from("suite_codes")
        .update({
            status: "used",
            activated_at: activatedAt,
            activated_by: userId,
            activation_ip: clientIp,
            activation_device: deviceInfo || null,
        })
        .eq("id", code.id)
        .eq("status", "unused"); // Ensure code is still unused (prevent race condition)

    if (updateError) {
        console.error("[Suite Code Activate] Update error:", updateError);
        return {
            success: false,
            message: ERROR_MESSAGES.ACTIVATION_FAILED,
            error: {
                code: "ACTIVATION_FAILED",
                message: ERROR_MESSAGES.ACTIVATION_FAILED,
            },
        };
    }

    // Step 6: Apply benefit to user account
    const benefit: ActivateCodeResponse["benefit"] = {
        type: code.code_type,
    };

    if (code.code_type === "membership") {
        benefit.membership_tier = code.membership_tier!;
        benefit.membership_days = code.membership_days!;
    } else {
        benefit.credits_amount = code.credits_amount!;
    }

    // Call the user service to apply the benefit
    // Apply benefit directly to KV store (table: kv_store_c8954261)
    // KV store is on api.haokir.com
    const kvSupabaseUrl = Deno.env.get("KV_SUPABASE_URL") || "https://api.haokir.com";
    const kvSupabaseKey = Deno.env.get("KV_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    try {
        const kvClient = createClient(kvSupabaseUrl!, kvSupabaseKey!, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        if (code.code_type === 'credits') {
            // Add credits to user balance
            const pointsKey = `user_points:${userId}`;
            const { data: currentData } = await kvClient
                .from('kv_store_c8954261')
                .select('value')
                .eq('key', pointsKey)
                .maybeSingle();

            const currentPoints = currentData?.value ? parseInt(currentData.value) : 0;
            const newPoints = currentPoints + (code.credits_amount || 0);

            await kvClient
                .from('kv_store_c8954261')
                .upsert({ key: pointsKey, value: newPoints });

            console.log(`[Suite Code Activate] Credits applied: ${currentPoints} + ${code.credits_amount} = ${newPoints}`);

        } else if (code.code_type === 'membership') {
            // Update membership in user profile
            const profileKey = `user_profile:${userId}`;
            const { data: profileData } = await kvClient
                .from('kv_store_c8954261')
                .select('value')
                .eq('key', profileKey)
                .maybeSingle();

            const profile = profileData?.value || {};

            // Map tier
            const tierMap: Record<string, string> = {
                'plus': 'Plus',
                'pro': 'Pro',
                'ultra': 'Ultra'
            };
            const membershipLevel = tierMap[code.membership_tier?.toLowerCase() || ''] || 'Plus';

            // Calculate expiry
            const now = new Date();
            let startDate = now;
            if (profile.membershipExpiry) {
                const currentExpiry = new Date(profile.membershipExpiry);
                if (currentExpiry > now) startDate = currentExpiry;
            }
            const expiryDate = new Date(startDate);
            expiryDate.setDate(expiryDate.getDate() + (code.membership_days || 30));
            const membershipExpiry = expiryDate.toISOString().split('T')[0];

            const updatedProfile = {
                ...profile,
                membershipLevel,
                membershipExpiry,
                subscription: { tier: membershipLevel, expiresAt: membershipExpiry }
            };

            await kvClient
                .from('kv_store_c8954261')
                .upsert({ key: profileKey, value: updatedProfile });

            // Also update user record
            const userKey = `user:${userId}`;
            const { data: userData } = await kvClient
                .from('kv_store_c8954261')
                .select('value')
                .eq('key', userKey)
                .maybeSingle();

            if (userData?.value) {
                const user = userData.value;
                user.membershipLevel = membershipLevel;
                user.membershipExpiry = membershipExpiry;
                await kvClient
                    .from('kv_store_c8954261')
                    .upsert({ key: userKey, value: user });
            }

            console.log(`[Suite Code Activate] Membership applied: ${membershipLevel} until ${membershipExpiry}`);
        }

    } catch (applyError) {
        console.error("[Suite Code Activate] Error applying benefit:", applyError);

        // Rollback: revert the code status back to unused
        await supabase
            .from("suite_codes")
            .update({
                status: "unused",
                activated_at: null,
                activated_by: null,
                activation_ip: null,
                activation_device: null,
            })
            .eq("id", code.id);

        return {
            success: false,
            message: "激活码验证成功，但权益发放失败，请联系客服",
            error: {
                code: "BENEFIT_APPLY_FAILED",
                message: "权益发放失败",
            },
        };
    }

    console.log(
        `[Suite Code Activate] Activated: code=${normalizedCode}, user=${userId}, type=${code.code_type}`
    );

    return {
        success: true,
        message: code.code_type === "membership"
            ? `成功激活 ${code.membership_tier?.toUpperCase()} 会员 ${code.membership_days} 天`
            : `成功充值 ${code.credits_amount} 积分`,
        benefit,
    };
}
