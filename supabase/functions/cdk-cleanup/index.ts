/**
 * CDK Cleanup Edge Function
 *
 * Supabase Edge Function for scheduled CDK inventory cleanup.
 * - Releases timeout reservations (every 5 minutes)
 * - Cleans up orphan reservations (every hour)
 *
 * Requirements: 6.1, 6.5, 6.6
 *
 * Deployment: supabase functions deploy cdk-cleanup
 * See README.md for scheduling configuration.
 */

// @ts-nocheck - Deno runtime types not available in Node.js TypeScript
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// CDK Status constants
const CDKStatus = {
    AVAILABLE: "available",
    RESERVED: "reserved",
    DELIVERED: "delivered",
    INVALID: "invalid",
} as const;

// Reservation timeout in minutes
const RESERVATION_TIMEOUT_MINUTES = 15;

interface CleanupResult {
    releasedCount: number;
    cancelledOrders: string[];
    errors: string[];
}

interface RequestBody {
    action?: "timeout" | "orphan" | "all";
}

interface CDKCode {
    id: string;
    order_id: string | null;
}

interface Order {
    id: string;
    status: string;
}

// CORS headers for the response
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Get Supabase client with service role key for admin operations
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase environment variables");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Parse request body to determine action
        let action: "timeout" | "orphan" | "all" = "all";

        if (req.method === "POST") {
            try {
                const body: RequestBody = await req.json();
                if (body.action) {
                    action = body.action;
                }
            } catch {
                // Default to "all" if body parsing fails
            }
        }

        const results: {
            timeout?: CleanupResult;
            orphan?: CleanupResult;
        } = {};

        // Execute timeout cleanup (Requirements: 6.1, 6.5)
        if (action === "timeout" || action === "all") {
            results.timeout = await releaseTimeoutReservations(supabase);
        }

        // Execute orphan cleanup (Requirement: 6.6)
        if (action === "orphan" || action === "all") {
            results.orphan = await cleanupOrphanReservations(supabase);
        }

        console.log("[CDK Cleanup] Completed:", JSON.stringify(results));

        return new Response(
            JSON.stringify({
                success: true,
                action,
                results,
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        console.error("[CDK Cleanup] Error:", error);

        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString(),
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 500,
            }
        );
    }
});

/**
 * Release timeout reservations
 *
 * Finds reserved codes older than 15 minutes and releases them back to available.
 * Also updates associated orders to cancelled status.
 *
 * Requirements: 6.1, 6.5
 */
async function releaseTimeoutReservations(
    supabase: SupabaseClient
): Promise<CleanupResult> {
    const now = new Date();
    const timeoutThreshold = new Date(
        now.getTime() - RESERVATION_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();
    const releasedAt = now.toISOString();

    const result: CleanupResult = {
        releasedCount: 0,
        cancelledOrders: [],
        errors: [],
    };

    // Step 1: Find reserved codes that have timed out
    const { data: timedOutCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id, order_id")
        .eq("status", CDKStatus.RESERVED)
        .lt("reserved_at", timeoutThreshold);

    if (selectError) {
        console.error("[CDK Cleanup] Select error:", selectError);
        result.errors.push("Failed to query timed out codes");
        return result;
    }

    if (!timedOutCodes || timedOutCodes.length === 0) {
        console.log("[CDK Cleanup] No timed out reservations found");
        return result;
    }

    // Group codes by order ID
    const orderCodeMap = new Map<string, string[]>();
    for (const code of timedOutCodes as CDKCode[]) {
        if (code.order_id) {
            const existing = orderCodeMap.get(code.order_id) || [];
            existing.push(code.id);
            orderCodeMap.set(code.order_id, existing);
        }
    }

    // Step 2: Release codes for each order
    for (const [orderId, codeIds] of orderCodeMap) {
        // Release codes back to available
        const { data: updatedCodes, error: updateError } = await supabase
            .from("cdk_codes")
            .update({
                status: CDKStatus.AVAILABLE,
                order_id: null,
                reserved_at: null,
                updated_at: releasedAt,
            })
            .in("id", codeIds)
            .eq("status", CDKStatus.RESERVED)
            .select("id");

        if (updateError) {
            console.error(`[CDK Cleanup] Failed to release codes for order ${orderId}:`, updateError);
            result.errors.push(`Failed to release codes for order ${orderId}`);
            continue;
        }

        const releasedCount = updatedCodes?.length || 0;
        result.releasedCount += releasedCount;

        // Create audit log entries
        if (releasedCount > 0) {
            const auditEntries = codeIds.map((codeId: string) => ({
                cdk_code_id: codeId,
                action: "released",
                old_status: CDKStatus.RESERVED,
                new_status: CDKStatus.AVAILABLE,
                order_id: orderId,
                actor_type: "system",
                reason: "payment_timeout",
                created_at: releasedAt,
            }));

            const { error: auditError } = await supabase
                .from("cdk_audit_logs")
                .insert(auditEntries);

            if (auditError) {
                console.error("[CDK Cleanup] Audit log error:", auditError);
            }
        }

        // Step 3: Update order status to cancelled (Requirement 6.1)
        const { error: orderUpdateError } = await supabase
            .from("orders")
            .update({
                status: "cancelled",
                updated_at: releasedAt,
            })
            .eq("id", orderId)
            .eq("status", "pending");

        if (orderUpdateError) {
            console.error(`[CDK Cleanup] Failed to cancel order ${orderId}:`, orderUpdateError);
            result.errors.push(`Failed to cancel order ${orderId}`);
        } else {
            result.cancelledOrders.push(orderId);
        }
    }

    console.log(
        `[CDK Cleanup] Timeout cleanup complete: released ${result.releasedCount} codes, cancelled ${result.cancelledOrders.length} orders`
    );

    return result;
}

/**
 * Cleanup orphan reservations
 *
 * Finds reserved codes with no valid associated order and releases them.
 *
 * Requirement: 6.6
 */
async function cleanupOrphanReservations(
    supabase: SupabaseClient
): Promise<CleanupResult> {
    const releasedAt = new Date().toISOString();

    const result: CleanupResult = {
        releasedCount: 0,
        cancelledOrders: [],
        errors: [],
    };

    // Step 1: Find reserved codes with order_id
    const { data: reservedCodes, error: selectError } = await supabase
        .from("cdk_codes")
        .select("id, order_id")
        .eq("status", CDKStatus.RESERVED)
        .not("order_id", "is", null);

    if (selectError) {
        console.error("[CDK Cleanup] Select error:", selectError);
        result.errors.push("Failed to query reserved codes");
        return result;
    }

    if (!reservedCodes || reservedCodes.length === 0) {
        console.log("[CDK Cleanup] No reserved codes found");
        return result;
    }

    // Get unique order IDs
    const orderIds = [...new Set(
        (reservedCodes as CDKCode[])
            .map((c: CDKCode) => c.order_id)
            .filter((id): id is string => id !== null)
    )];

    // Step 2: Check which orders exist and are in valid state
    const { data: validOrders, error: orderError } = await supabase
        .from("orders")
        .select("id, status")
        .in("id", orderIds);

    if (orderError) {
        console.error("[CDK Cleanup] Order query error:", orderError);
        result.errors.push("Failed to query orders");
        return result;
    }

    // Build set of valid order IDs (pending and paid orders are valid)
    const validOrderIds = new Set(
        ((validOrders || []) as Order[])
            .filter((o: Order) => o.status === "pending" || o.status === "paid")
            .map((o: Order) => o.id)
    );

    // Step 3: Find orphan codes (order doesn't exist or is in terminal state)
    const orphanCodes = (reservedCodes as CDKCode[]).filter(
        (c: CDKCode) => c.order_id && !validOrderIds.has(c.order_id)
    );

    if (orphanCodes.length === 0) {
        console.log("[CDK Cleanup] No orphan reservations found");
        return result;
    }

    const orphanCodeIds = orphanCodes.map((c: CDKCode) => c.id);

    // Step 4: Release orphan codes
    const { data: updatedCodes, error: updateError } = await supabase
        .from("cdk_codes")
        .update({
            status: CDKStatus.AVAILABLE,
            order_id: null,
            reserved_at: null,
            updated_at: releasedAt,
        })
        .in("id", orphanCodeIds)
        .eq("status", CDKStatus.RESERVED)
        .select("id");

    if (updateError) {
        console.error("[CDK Cleanup] Update error:", updateError);
        result.errors.push("Failed to release orphan codes");
        return result;
    }

    result.releasedCount = updatedCodes?.length || 0;

    // Step 5: Create audit log entries
    if (result.releasedCount > 0) {
        const auditEntries = orphanCodeIds.map((codeId: string) => ({
            cdk_code_id: codeId,
            action: "released",
            old_status: CDKStatus.RESERVED,
            new_status: CDKStatus.AVAILABLE,
            actor_type: "system",
            reason: "orphan_cleanup",
            created_at: releasedAt,
        }));

        const { error: auditError } = await supabase
            .from("cdk_audit_logs")
            .insert(auditEntries);

        if (auditError) {
            console.error("[CDK Cleanup] Audit log error:", auditError);
        }
    }

    console.log(
        `[CDK Cleanup] Orphan cleanup complete: released ${result.releasedCount} codes`
    );

    return result;
}
