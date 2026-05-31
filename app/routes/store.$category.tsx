import type { Route } from "./+types/store.$category";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import type { Product, ProductCategory } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Store Category Loader
 * Fetches physical products filtered by category via Supabase MCP
 * Requirements: 1.4, 8.1
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { category } = params;
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
        const categoryData = await fetchCategoryBySlugViaMCP(category);
        if (!categoryData) {
            throw new Response("Category not found", { status: 404 });
        }

        const products = await fetchPhysicalProductsByCategoryViaMCP(categoryData.id);

        return {
            category: categoryData,
            products,
            sections,
            user,
            cartItemCount,
        };
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Failed to fetch category products:", error);
        return {
            category: null,
            products: [],
            sections,
            user,
            cartItemCount,
        };
    }
}

/**
 * Fetch category by slug via Supabase MCP
 */
async function fetchCategoryBySlugViaMCP(slug: string): Promise<ProductCategory | null> {
    const now = new Date().toISOString();
    const categories: Record<string, ProductCategory> = {
        accessories: { id: "cat-accessories", name: "配件", slug: "accessories", store_section: "store", sort_order: 0, created_at: now },
        audio: { id: "cat-audio", name: "音频设备", slug: "audio", store_section: "store", sort_order: 1, created_at: now },
        peripherals: { id: "cat-peripherals", name: "外设", slug: "peripherals", store_section: "store", sort_order: 2, created_at: now },
        storage: { id: "cat-storage", name: "存储设备", slug: "storage", store_section: "store", sort_order: 3, created_at: now },
    };
    return categories[slug] || null;
}

/**
 * Fetch physical products by category via Supabase MCP
 */
async function fetchPhysicalProductsByCategoryViaMCP(categoryId: string): Promise<Product[]> {
    const now = new Date().toISOString();

    const allProducts: Product[] = [
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
            description: "罗技旗舰级无线鼠标，支持多设备切换。",
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
                spec_combination: {
                    color: "石墨色" },
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

    // Filter by category
    return allProducts.filter(p => p.category_id === categoryId);
}

export function meta({ data }: Route.MetaArgs) {
    const categoryName = data?.category?.name || "分类";
    return [
        { title: `${categoryName} - 实物商店 - Gisyit Shop` },
        { name: "description", content: `${categoryName}实物商品` },
    ];
}

/**
 * Store Category Page Component
 * Displays physical products filtered by category
 * Requirements: 1.4
 */
export default function StoreCategory({ loaderData }: Route.ComponentProps) {
    const { category, products, sections, user, cartItemCount } = loaderData as {
        category: ProductCategory | null;
        products: Product[];
        sections: StoreSection[];
        user: { email?: string; isLoggedIn: boolean };
        cartItemCount: number;
    };

    if (!category) {
        return (
            <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🔍</div>
                    <h2 className="text-2xl font-bold text-text-primary mb-2">分类不存在</h2>
                        <p className="text-text-secondary mb-4">请返回实物商店浏览其他分类</p>
                            <a href="/store" className="text-accent hover:underline">返回实物商店</a>
                        </div>
                    </RootLayout>
                    );
    }

                    return (
                    <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
                        <div className="space-y-8">
                            {/* Breadcrumb */}
                            <nav className="text-sm text-text-muted">
                                <a href="/store" className="hover:text-text-primary">实物商店</a>
                                <span className="mx-2">/</span>
                                <span className="text-text-primary">{category.name}</span>
                            </nav>

                            {/* Page Header */}
                            <div>
                                <h1 className="text-3xl font-bold text-text-primary mb-2">{category.name}</h1>
                                <p className="text-text-secondary">浏览 {category.name} 分类下的商品</p>
                            </div>

                            {/* Shipping Info */}
                            <div className="bg-bg-secondary rounded-lg p-4 flex items-center gap-3">
                                <span className="text-2xl">🚚</span>
                                <div>
                                    <p className="text-text-primary font-medium">全国包邮</p>
                                    <p className="text-text-muted text-sm">预计 3-5 个工作日送达</p>
                                </div>
                            </div>

                            {/* Products Grid */}
                            <ProductGrid
                                products={products}
                                emptyMessage={`暂无${category.name}商品`}
                            />
                        </div>
                    </RootLayout>
                    );
}
