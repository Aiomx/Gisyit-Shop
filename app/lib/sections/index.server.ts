import { getSupabaseClient } from "~/lib/supabase/client.server";
import { withCache, cacheKey } from "~/lib/cache";
import type { StoreSection } from "./index";

export type { StoreSection };

/**
 * Fetch all active store sections (server-side, 带缓存)
 */
export async function getSections(): Promise<StoreSection[]> {
    const key = cacheKey('sections', 'all');

    return withCache(key, async () => {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("store_sections")
            .select("*")
            .eq("is_active", true)
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error fetching sections:", error);
            return [];
        }

        return data || [];
    });
}

/**
 * Get section by slug (server-side, 带缓存)
 */
export async function getSectionBySlug(slug: string): Promise<StoreSection | null> {
    const key = cacheKey('sections', 'slug', slug);

    return withCache(key, async () => {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("store_sections")
            .select("*")
            .eq("slug", slug)
            .eq("is_active", true)
            .single();

        if (error) {
            console.error("Error fetching section:", error);
            return null;
        }

        return data;
    });
}
