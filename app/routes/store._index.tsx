import type { Route } from "./+types/store._index";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";

/**
 * Store Index Loader
 * Fetches physical products via Supabase MCP
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
            const [productsResult, categoriesResult] = await Promise.all([
                getProductsBySection("store"),
                getCategories("store"),
            ]);

            return {
                products: productsResult.data || [],
                categories: categoriesResult.data || [],
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const products = await fetchPhysicalProductsMock();
        const categories = await fetchStoreCategoriesMock();

        return {
            products,
            categories,
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Failed to fetch physical products:", error);
        return {
            products: [],
            categories: [],
            user,
            cartItemCount,
            sections,
        };
    }
}

/**
 * Fetch physical products mock for development
 */
async function fetchPhysicalProductsMock(): Promise<Product[]> {
    return getMockPhysicalProducts();
}

/**
 * Fetch store categories mock for development
 */
async function fetchStoreCategoriesMock(): Promise<ProductCategory[]> {
    const now = new Date().toISOString();
    return [
        { id: "cat-accessories", name: "配件", slug: "accessories", store_section: "store", sort_order: 0, created_at: now },
        { id: "cat-audio", name: "音频设备", slug: "audio", store_section: "store", sort_order: 1, created_at: now },
        { id: "cat-peripherals", name: "外设", slug: "peripherals", store_section: "store", sort_order: 2, created_at: now },
        { id: "cat-storage", name: "存储设备", slug: "storage", store_section: "store", sort_order: 3, created_at: now },
    ];
}

/**
 * Mock physical products for development
 */
function getMockPhysicalProducts(): Product[] {
    const now = new Date().toISOString();
    return [
        {
            id: "physical-001",
            product_code: "Gis00000005",
            name: "Apple Magic Keyboard",
            subtitle: "带触控 ID 的妙控键盘",
            description: "专为 Mac 设计的无线键盘，配备触控 ID 指纹识别。",
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-accessories",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 15,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-005", product_id: "physical-001",
                image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop",
                alt_text: "Magic Keyboard", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-005", product_id: "physical-001",
                spec_combination: { color: "银色" },
                price_amount: 999.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "physical-002",
            product_code: "Gis00000006",
            name: "AirPods Pro 2",
            subtitle: "主动降噪无线耳机",
            description: "Apple 第二代 AirPods Pro，支持主动降噪和空间音频。",
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-audio",
            is_active: true,
            has_discount: true,
            has_demo_video: false,
            inventory_count: 30,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-006", product_id: "physical-002",
                image_url: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&h=600&fit=crop",
                alt_text: "AirPods Pro 2", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-006", product_id: "physical-002",
                price_amount: 1899.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "physical-003",
            product_code: "Gis00000013",
            name: "Logitech MX Master 3S",
            subtitle: "高端无线鼠标",
            description: "罗技旗舰级无线鼠标，支持多设备切换和自定义按键功能。",
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-peripherals",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 25,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-013", product_id: "physical-003",
                image_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&h=600&fit=crop",
                alt_text: "MX Master 3S", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-013", product_id: "physical-003",
                spec_combination: { color: "石墨色" },
                price_amount: 799.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "physical-004",
            product_code: "Gis00000014",
            name: "Samsung T7 Shield 1TB",
            subtitle: "便携式固态硬盘",
            description: "三星便携式 SSD，防水防尘，传输速度高达 1050MB/s。",
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-storage",
            is_active: true,
            has_discount: true,
            has_demo_video: false,
            inventory_count: 40,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-014", product_id: "physical-004",
                image_url: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&h=600&fit=crop",
                alt_text: "Samsung T7 Shield", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-014", product_id: "physical-004",
                spec_combination: { capacity: "1TB" },
                price_amount: 899.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
    ];
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "实物商店 - Gisyit Shop" },
        { name: "description", content: "配件、外设、数码产品" },
    ];
}

/**
 * Store Index Page Component
 * Displays physical products organized by category
 * Requirements: 1.4, 4.5
 */
export default function StoreIndex({ loaderData }: Route.ComponentProps) {
    const { products, categories, user, cartItemCount, sections } = loaderData;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">实物商店</h1>
                    <p className="text-text-secondary">配件、外设、数码产品，全国包邮</p>
                </div>

                {/* Shipping Info Banner */}
                <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                    <span className="text-2xl">🚚</span>
                    <div>
                        <p className="text-text-primary font-medium">全国包邮</p>
                        <p className="text-text-muted text-sm">订单满99元免运费，预计3-5 个工作日送达</p>
                    </div>
                </div>

                {/* Category Quick Links */}
                {categories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category: ProductCategory) => (
                            <a
                                key={category.id}
                                href={`/store/${category.slug}`}
                                className="px-4 py-2 rounded-full bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors text-sm"
                            >
                                {category.name}
                            </a>
                        ))}
                    </div>
                )}

                {/* Products Grid */}
                <ProductGrid
                    products={products}
                    emptyMessage="暂无实物商品"
                />
            </div>
        </RootLayout>
    );
}
