import type { Route } from "./+types/overseas._index";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import { Badge } from "~/components/ui/badge";
import type { Product, ProductCategory } from "~/lib/supabase/types";

/**
 * Overseas Index Loader
 * Fetches overseas purchase products via Supabase MCP
 * Requirements: 1.1, 4.5 - Uses GET method via MCP to fetch product data
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { getProductsBySection, getCategories } = await import("~/lib/product/index.server");
    const { getMCPBridge } = await import("~/lib/supabase/mcp-client.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getSections } = await import("~/lib/sections/index.server");

    // Get user info for header display (Requirements 4.5)
    const user = await getUserForHeader(request);

    // Get sections for navigation
    const sections = await getSections();

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
        // Check if MCP bridge is available
        const mcpBridge = getMCPBridge();

        if (mcpBridge) {
            // Use real MCP to fetch products (Requirements 1.1)
            const [productsResult, regionsResult] = await Promise.all([
                getProductsBySection("overseas"),
                getCategories("overseas"),
            ]);

            return {
                products: productsResult.data || [],
                regions: regionsResult.data || [],
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const products = await fetchOverseasProductsMock();
        const regions = await fetchOverseasRegionsMock();

        return {
            products,
            regions,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch overseas products:", error);
        return {
            products: [],
            regions: [],
            user,
            cartItemCount,
            sections,
        };
    }
}

/**
 * Fetch overseas products mock for development
 */
async function fetchOverseasProductsMock(): Promise<Product[]> {
    return getMockOverseasProducts();
}

/**
 * Fetch overseas regions mock for development
 */
async function fetchOverseasRegionsMock(): Promise<ProductCategory[]> {
    const now = new Date().toISOString();
    return [
        { id: "cat-japan", name: "日本代购", slug: "japan", store_section: "overseas", sort_order: 0, created_at: now },
        { id: "cat-korea", name: "韩国代购", slug: "korea", store_section: "overseas", sort_order: 1, created_at: now },
        { id: "cat-usa", name: "美国代购", slug: "usa", store_section: "overseas", sort_order: 2, created_at: now },
        { id: "cat-europe", name: "欧洲代购", slug: "europe", store_section: "overseas", sort_order: 3, created_at: now },
    ];
}

/**
 * Mock overseas products for development
 */
function getMockOverseasProducts(): Product[] {
    const now = new Date().toISOString();
    return [
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
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "海外代购 - Gisyit Shop" },
        { name: "description", content: "日本、韩国、美国、欧洲代购服务" },
    ];
}

/**
 * Overseas Index Page Component
 * Displays overseas purchase products with delivery time and tax information
 * Requirements: 1.5, 4.5
 */
export default function OverseasIndex({ loaderData }: Route.ComponentProps) {
    const { products, regions, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">海外代购</h1>
                    <p className="text-text-secondary">日本、韩国、美国、欧洲正品代购</p>
                </div>

                {/* Service Info Banners */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                        <span className="text-2xl">✈️</span>
                        <div>
                            <p className="text-text-primary font-medium">国际直邮</p>
                            <p className="text-text-muted text-sm">5-15 个工作日送达</p>
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
                            <p className="text-text-muted text-sm">7 天无理由退货</p>
                        </div>
                    </div>
                </div>

                {/* Region Quick Links */}
                {regions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {regions.map((region: ProductCategory) => (
                            <a
                                key={region.id}
                                href={`/overseas/${region.slug}`}
                                className="px-4 py-2 rounded-full bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-sm flex items-center gap-2"
                            >
                                <RegionFlag region={region.slug} />
                                {region.name}
                            </a>
                        ))}
                    </div>
                )}

                {/* Products Grid */}
                <ProductGrid
                    products={products}
                    emptyMessage="暂无海外代购商品"
                />
            </div>
        </RootLayout>
    );
}

/**
 * Region flag emoji component
 */
function RegionFlag({ region }: { region: string }) {
    const flags: Record<string, string> = {
        japan: "🇯🇵",
        korea: "🇰🇷",
        usa: "🇺🇸",
        europe: "🇪🇺",
    };
    return <span>{flags[region] || "🌍"}</span>;
}
