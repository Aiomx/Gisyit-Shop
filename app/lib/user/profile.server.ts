/**
 * User Profile Server Functions
 * 
 * Uses Supabase client for real database operations.
 */

import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { UserProfile, UserProfileUpdate, OrderStats, UserProfileData, OrderSummary } from "./types";
import type { Order } from "~/lib/supabase/types";

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<{
    success: boolean;
    profile?: UserProfile;
    error?: { code: string; message: string };
}> {
    try {
        const supabase = getSupabaseClient();

        // Try to get profile from profiles table
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            // Profile might not exist yet, return basic info
            console.log("[Profile] Profile not found, returning basic info");
            return {
                success: true,
                profile: {
                    id: userId,
                    email: "",
                    created_at: new Date().toISOString(),
                },
            };
        }

        // Map profiles table to UserProfile type
        const userProfile: UserProfile = {
            id: profile.id,
            email: "", // Will be filled from auth
            nickname: profile.full_name || undefined,
            custom_id: undefined,
            phone: undefined,
            avatar_url: profile.avatar_url || undefined,
            created_at: profile.updated_at || new Date().toISOString(),
        };

        return { success: true, profile: userProfile };
    } catch (error) {
        console.error("Failed to get user profile:", error);
        return {
            success: false,
            error: { code: "PROFILE_FETCH_ERROR", message: "获取用户资料失败" },
        };
    }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
    userId: string,
    updates: UserProfileUpdate
): Promise<{
    success: boolean;
    profile?: UserProfile;
    error?: { code: string; message: string };
}> {
    try {
        // Validate custom_id format
        if (updates.custom_id) {
            if (!/^[a-zA-Z0-9_]{4,20}$/.test(updates.custom_id)) {
                return {
                    success: false,
                    error: {
                        code: "INVALID_CUSTOM_ID",
                        message: "自定义ID只能包含字母、数字和下划线，长度4-20位",
                    },
                };
            }
        }

        // Validate phone format
        if (updates.phone) {
            if (!/^1[3-9]\d{9}$/.test(updates.phone)) {
                return {
                    success: false,
                    error: {
                        code: "INVALID_PHONE",
                        message: "请输入有效的手机号码",
                    },
                };
            }
        }

        const supabase = getSupabaseClient();

        // Update profiles table
        const { data: profile, error } = await supabase
            .from("profiles")
            .upsert({
                id: userId,
                full_name: updates.nickname,
                avatar_url: updates.avatar_url,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error("Failed to update profile:", error);
            return {
                success: false,
                error: { code: "PROFILE_UPDATE_ERROR", message: "更新用户资料失败" },
            };
        }

        const userProfile: UserProfile = {
            id: profile.id,
            email: "",
            nickname: profile.full_name || undefined,
            avatar_url: profile.avatar_url || undefined,
            created_at: profile.updated_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        return { success: true, profile: userProfile };
    } catch (error) {
        console.error("Failed to update user profile:", error);
        return {
            success: false,
            error: { code: "PROFILE_UPDATE_ERROR", message: "更新用户资料失败" },
        };
    }
}

/**
 * Get order statistics for user
 */
export async function getOrderStats(_userId: string, orders: Order[]): Promise<OrderStats> {
    const stats: OrderStats = {
        total: orders.length,
        pending: 0,
        processing: 0,
        shipped: 0,
        completed: 0,
        cancelled: 0,
    };

    for (const order of orders) {
        switch (order.status) {
            case "created":
            case "pending_payment":
                stats.pending++;
                break;
            case "paid":
                stats.processing++;
                break;
            case "fulfilled":
                stats.shipped++;
                break;
            case "completed":
                stats.completed++;
                break;
            case "cancelled":
                stats.cancelled++;
                break;
        }
    }

    return stats;
}

/**
 * Get order summaries for display
 */
export function getOrderSummaries(orders: Order[], limit?: number): OrderSummary[] {
    const sorted = [...orders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const limited = limit ? sorted.slice(0, limit) : sorted;

    return limited.map((order) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        currency: order.currency,
        created_at: order.created_at,
        item_count: order.items?.length || 0,
    }));
}

/**
 * Get full user profile data including orders
 */
export async function getUserProfileData(
    userId: string,
    email: string,
    orders: Order[]
): Promise<UserProfileData> {
    const profileResult = await getUserProfile(userId);

    const profile: UserProfile = profileResult.profile || {
        id: userId,
        email,
        created_at: new Date().toISOString(),
    };

    // Override email from auth
    profile.email = email;

    const orderStats = await getOrderStats(userId, orders);
    const recentOrders = getOrderSummaries(orders, 5);

    return {
        profile,
        orderStats,
        recentOrders,
    };
}
