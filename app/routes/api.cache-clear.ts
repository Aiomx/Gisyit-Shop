import type { Route } from "./+types/api.cache-clear";
import { clearCache, invalidateCacheByPrefix } from "~/lib/cache";

/**
 * Cache Clear API
 * GET /api/cache-clear - 清空所有缓存
 * GET /api/cache-clear?prefix=sections - 清空指定前缀的缓存
 */
export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const prefix = url.searchParams.get("prefix");

    if (prefix) {
        invalidateCacheByPrefix(prefix);
        return Response.json({ success: true, message: `Cache cleared for prefix: ${prefix}` });
    }

    clearCache();
    return Response.json({ success: true, message: "All cache cleared" });
}
