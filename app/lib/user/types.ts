/**
 * User Profile Types
 */

export interface UserProfile {
    id: string;
    email: string;
    nickname?: string;
    custom_id?: string;
    phone?: string;
    avatar_url?: string;
    created_at: string;
    updated_at?: string;
}

export interface UserProfileUpdate {
    nickname?: string;
    custom_id?: string;
    phone?: string;
    avatar_url?: string;
}

export interface OrderStats {
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    completed: number;
    cancelled: number;
}

export interface UserProfileData {
    profile: UserProfile;
    orderStats: OrderStats;
    recentOrders: OrderSummary[];
}

export interface OrderSummary {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
    currency: string;
    created_at: string;
    item_count: number;
}
