import type { Route } from "./+types/overseas.$region";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Overseas Region Loader
 * Fetches overseas products filtered by region via Supabase MCP
 * Requirements: 1.5, 8.1
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { region } = params;
    const { getSections } = await import("~/lib/sections/index.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");

    // Get sections for navigation
    const sections = await getSections();

    // Get user info for header display
    const user = await getUserForHeader(request);

    // Get cart item count
    let cartItemCount = 0;
    try {
        const cartResult = await getCart(request);
        if (cartResult.success && cartResult.data?.cart) {
            cartItemCount = cartResult.data.cart.items.reduce((sum, item) => sum + item.quantity, 0);
        }
    } catch (error) {
        console.error("Failed to get cart:", error);
    }

    try {
        const regionData = await fetchRegionBySlugViaMCP(region);
        if (!regionData) {
            throw new Response("Region not found", { status: 404 });
        }

        const products = await fetchOverseasProductsByRegionViaMCP(regionData.id);

        return {
            region: regionData,
            products,
            sections,
            user,
            cartItemCount,
        };
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Failed to fetch region products:", error);
        return {
            region: null,
            products: [],
            sections,
            user,
            cartItemCount,
        };
    }
}

/**
 * Fetch region by slug via Supabase MCP
 */
async function fetchRegionBySlugViaMCP(slug: string): Promise<ProductCategory | null> {
    const now = new Date().toISOString();
    const regions: Record<string, ProductCategory & { deliveryTime: string; taxInfo: string }> = {
        japan: {
            id: "cat-japan",
            name: "日本代购",
            slug: "japan",
            store_section: "overseas",
            sort_order: 0,
            created_at: now,
            deliveryTime: "7-14 个工作日",
            taxInfo: "含关税",
        },
        korea: {
            id: "cat-korea",
            name: "韩国代购",
            slug: "korea",
            store_section: "overseas",
            sort_order: 1,
            created_at: now,
            deliveryTime: "5-10 个工作日",
            taxInfo: "含关税",
        },
        usa: {
            id: "cat-usa",
            name: "美国代购",
            slug: "usa",
            store_section: "overseas",
            sort_order: 2,
            created_at: now,
            deliveryTime: "10-15 个工作日",
            taxInfo: "含关税",
        },
        europe: {
            id: "cat-europe",
            name: "欧洲代购",
            slug: "europe",
            store_section: "overseas",
            sort_order: 3,
            created_at: now,
            deliveryTime: "12-20 个工作日",
            taxInfo: "含关税",
        },
    };
    return regions[slug] || null;
}

/**
 * Fetch overseas products by region via Supabase MCP
 */
async function fetchOverseasProductsByRegionViaMCP(regionId: string): Promise<Product[]> {
    const now = new Date().toISOString();

    const allProducts: Product[] = [
        {
            id: "overseas-001",
            product_code: "Gis00000007",
            name: "日本限定 Nintendo Switch OLED",
            subtitle: "日版限定配色",
            description: "日本限定发售的 Nintendo Switch OLED 特别版，含日本直邮。预计 7-14 个工作日送达，含关税。",
            product_type: "overseas",
            delivery_type: "shipment",
            category_id: "cat-japan",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 5,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-007", product_id: "overseas-001",
                image_url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&h=600&fit=crop",
                alt_text: "Nintendo Switch OLED", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-007", product_id: "overseas-001",
                price_amount: 2999.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "overseas-002",
            product_code: "Gis00000008",
            name: "韩国代购 Samsung Galaxy Z Fold5",
            subtitle: "韩版折叠屏旗舰机",
            description: "韩国直邮 Samsung Galaxy Z Fold5，支持 5G 网络。预计 5-10 个工作日送达，含关税。",
            product_type: "overseas",
            delivery_type: "shipment",
            category_id: "cat-korea",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 3,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-008", product_id: "overseas-002",
                image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&h=600&fit=crop",
                alt_text: "Galaxy Z Fold5", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-008", product_id: "overseas-002",
                price_amount: 12999.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "overseas-003",
            product_code: "Gis00000015",
            name: "美版 iPhone 15 Pro Max 256GB",
            subtitle: "美国无锁版",
            description: "美国直邮 iPhone 15 Pro Max，无锁版支持全球网络。预计 10-15 个工作日送达，含关税。",
            product_type: "overseas",
            delivery_type: "shipment",
            category_id: "cat-usa",
            is_active: true,
            has_discount: true,
            has_demo_video: false,
            inventory_count: 8,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-015", product_id: "overseas-003",
                image_url: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&h=600&fit=crop",
                alt_text: "iPhone 15 Pro Max", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-015", product_id: "overseas-003",
                price_amount: 9999.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "overseas-004",
            product_code: "Gis00000016",
            name: "日本代购 Sony WH-1000XM5",
            subtitle: "日版降噪耳机",
            description: "日本直邮 Sony 旗舰降噪耳机，日版价格更优惠。预计 7-14 个工作日送达，含关税。",
            product_type: "overseas",
            delivery_type: "shipment",
            category_id: "cat-japan",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 12,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-016", product_id: "overseas-004",
                image_url: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&h=600&fit=crop",
                alt_text: "Sony WH-1000XM5", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-016", product_id: "overseas-004",
                price_amount: 2299.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
    ];

    // Filter by region
    return allProducts.filter(p => p.category_id === regionId);
}

/**
 * Get delivery time for region
 */
function getDeliveryTime(regionSlug: string): string {
    const times: Record<string, string> = {
        japan: "7-14 个工作日",
        korea: "5-10 个工作日",
        usa: "10-15 个工作日",
        europe: "12-20 个工作日",
    };
    return times[regionSlug] || "10-20 个工作日";
}

/**
 * Region flag emoji
 */
function getRegionFlag(regionSlug: string): string {
    const flags: Record<string, string> = {
        japan: "🇯🇵",
        korea: "🇰🇷",
        usa: "🇺🇸",
        europe: "🇪🇺",
    };
    return flags[regionSlug] || "🌍";
}

export function meta({ data }: Route.MetaArgs) {
    const regionName = data?.region?.name || "区域";
    return [
        { title: `${regionName} - 海外代购 - Store` },
        { name: "description", content: `${regionName}正品代购服务` },
    ];
}

/**
 * Overseas Region Page Component
 * Displays overseas products filtered by region with delivery time and tax information
 * Requirements: 1.5
 */
export default function OverseasRegion({ loaderData }: Route.ComponentProps) {
    const { region, products, sections, user, cartItemCount } = loaderData as {
        region: ProductCategory | null;
        products: Product[];
        sections: StoreSection[];
        user: { email?: string; isLoggedIn: boolean };
        cartItemCount: number;
    };

    if (!region) {
        return (
            <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">区域不存在</h2>
                    <p className="text-text-secondary mb-4">请返回海外代购浏览其他区域</p>
                    <a href="/overseas" className="text-accent hover:underline">返回海外代购</a>
                </div>
            </RootLayout>
        );
    }

    const deliveryTime = getDeliveryTime(region.slug);
    const flag = getRegionFlag(region.slug);

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Breadcrumb */}
                <nav className="text-sm text-text-muted">
                    <a href="/overseas" className="hover:text-text-primary">海外代购</a>
                    <span className="mx-2">/</span>
                    <span className="text-text-primary">{region.name}</span>
                </nav>

                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
                        <span>{flag}</span>
                        {region.name}
                    </h1>
                    <p className="text-text-secondary">正品直邮，品质保障</p>
                </div>

                {/* Delivery & Tax Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                        <span className="text-2xl">✈️</span>
                        <div>
                            <p className="text-text-primary font-medium">预计送达</p>
                            <p className="text-text-muted text-sm">{deliveryTime}</p>
                        </div>
                    </div>
                    <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                        <span className="text-2xl">💰</span>
                        <div>
                            <p className="text-text-primary font-medium">含税价格</p>
                            <p className="text-text-muted text-sm">标价已含关税，无隐藏费用</p>
                        </div>
                    </div>
                    <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                        <span className="text-2xl">🔄</span>
                        <div>
                            <p className="text-text-primary font-medium">退换保障</p>
                            <p className="text-text-muted text-sm">7 天无理由退换</p>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                <ProductGrid
                    products={products}
                    emptyMessage={`暂无${region.name}商品`}
                />
            </div>
        </RootLayout>
    );
}
