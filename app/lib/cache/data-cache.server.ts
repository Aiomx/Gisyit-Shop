/**
 * Server-side Data Cache
 * 
 * 内存缓存，用于减少重复的数据库请求
 * 注意：这是进程内缓存，服务器重启后会清空
 */

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

// 缓存存储
const cache = new Map<string, CacheItem<unknown>>();

// 默认缓存时间：5分钟
const DEFAULT_TTL = 5 * 60 * 1000;

// 不同类型数据的缓存时间
const CACHE_TTL: Record<string, number> = {
    sections: 5 * 60 * 1000,       // 分类导航：5分钟
    categories: 10 * 60 * 1000,    // 产品分类：10分钟
    products: 2 * 60 * 1000,       // 产品列表：2分钟
    featuredProducts: 2 * 60 * 1000, // 首页推荐：2分钟
    user: 30 * 1000,               // 用户信息：30秒
    cart: 10 * 1000,               // 购物车：10秒
};

/**
 * 获取缓存数据
 */
export function getCached<T>(key: string): T | null {
    const item = cache.get(key);
    if (!item) return null;

    // 根据 key 前缀确定 TTL
    const prefix = key.split(':')[0];
    const ttl = CACHE_TTL[prefix] || DEFAULT_TTL;

    if (Date.now() - item.timestamp > ttl) {
        cache.delete(key);
        return null;
    }

    return item.data as T;
}

/**
 * 设置缓存数据
 */
export function setCache<T>(key: string, data: T): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
    });
}

/**
 * 删除缓存
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * 按前缀删除缓存
 */
export function invalidateCacheByPrefix(prefix: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/**
 * 清空所有缓存
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * 带缓存的数据获取
 * 如果缓存存在则返回缓存，否则执行 fetcher 并缓存结果
 */
export async function withCache<T>(
    key: string,
    fetcher: () => Promise<T>
): Promise<T> {
    const cached = getCached<T>(key);
    if (cached !== null) {
        return cached;
    }

    const data = await fetcher();
    setCache(key, data);
    return data;
}

/**
 * 生成缓存 key
 */
export function cacheKey(type: string, ...parts: (string | number | undefined)[]): string {
    const validParts = parts.filter(p => p !== undefined);
    return validParts.length > 0 ? `${type}:${validParts.join(':')}` : type;
}
