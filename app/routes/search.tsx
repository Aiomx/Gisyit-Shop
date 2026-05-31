import type { Route } from "./+types/search";
import { RootLayout } from "~/components/layout";
import { ProductGrid } from "~/components/product";
import { SearchInput, SearchFilters, SearchEmptyState } from "~/components/search";
import type { Product, ProductCategory, ProductType } from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";

/**
 * Search Route Loader
 * Queries products via Supabase MCP matching name/description
 * Supports filtering by product type and category
 * Requirements: 1.1, 4.5 - Uses GET method via MCP to fetch product data
 */
export async function loader({ request }: Route.LoaderArgs) {
    const { searchProducts, getCategories } = await import("~/lib/product/index.server");
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

    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const productType = url.searchParams.get("type") as ProductType | null;
    const categoryId = url.searchParams.get("category");

    try {
        // Check if MCP bridge is available
        const mcpBridge = getMCPBridge();

        if (mcpBridge && query.trim()) {
            // Use real MCP to search products (Requirements 1.1)
            const [productsResult, categoriesResult] = await Promise.all([
                searchProducts(query, {
                    type: productType || undefined,
                    category_id: categoryId || undefined,
                }),
                getCategories(),
            ]);

            return {
                query,
                products: productsResult.data || [],
                categories: categoriesResult.data || [],
                filters: {
                    productType,
                    categoryId,
                },
                user,
                cartItemCount,
                sections,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const products = query.trim()
            ? await searchProductsMock(query, productType, categoryId)
            : [];

        const categories = await fetchCategoriesMock();

        return {
            query,
            products,
            categories,
            filters: {
                productType,
                categoryId,
            },
            user,
            cartItemCount,
            sections,
        };
    } catch (error) {
        console.error("Search failed:", error);
        return {
            query,
            products: [],
            categories: [],
            filters: {
                productType,
                categoryId,
            },
            user,
            cartItemCount,
            sections,
        };
    }
}

/**
 * Search products mock for development
 */
async function searchProductsMock(
    searchTerm: string,
    productType: ProductType | null,
    categoryId: string | null
): Promise<Product[]> {
    const mockProducts = getMockSearchProducts();
    const normalizedTerm = searchTerm.toLowerCase().trim();

    // Filter by search term (name or description)
    let results = mockProducts.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(normalizedTerm);
        const descMatch = p.description?.toLowerCase().includes(normalizedTerm) || false;
        return nameMatch || descMatch;
    });

    // Apply product type filter
    if (productType) {
        results = results.filter(p => p.product_type === productType);
    }

    // Apply category filter
    if (categoryId) {
        results = results.filter(p => p.category_id === categoryId);
    }

    return results;
}

/**
 * Fetch categories mock for development
 */
async function fetchCategoriesMock(): Promise<ProductCategory[]> {
    const now = new Date().toISOString();
    return [
        { id: "cat-design", name: "设计工具", slug: "design", store_section: "apps", sort_order: 0, created_at: now },
        { id: "cat-utilities", name: "系统工具", slug: "utilities", store_section: "apps", sort_order: 1, created_at: now },
        { id: "cat-games", name: "游戏", slug: "games", store_section: "games", sort_order: 2, created_at: now },
        { id: "cat-physical", name: "实物商品", slug: "physical", store_section: "store", sort_order: 3, created_at: now },
    ];
}

/**
 * Mock products for search (combines products from all sections)
 */
function getMockSearchProducts(): Product[] {
    const now = new Date().toISOString();
    return [
        {
            id: "app-001",
            product_code: "Gis00000001",
            name: "Sketch Pro",
            subtitle: "专业级矢量设计工具",
            description: "Sketch Pro 是一款专为 Mac 设计的专业矢量图形编辑器，适合 UI/UX 设计师使用。",
            product_type: "app",
            delivery_type: "download",
            category_id: "cat-design",
            is_active: true,
            has_discount: true,
            has_demo_video: true,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-001", product_id: "app-001",
                image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
                alt_text: "Sketch Pro", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-001", product_id: "app-001",
                spec_combination: { platform: "Mac" },
                price_amount: 299.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "app-002",
            product_code: "Gis00000002",
            name: "CleanMyMac X",
            subtitle: "Mac 系统优化清理工具",
            description: "一键清理系统垃圾，优化 Mac 性能，让你的电脑焕然一新。",
            product_type: "app",
            delivery_type: "license_key",
            category_id: "cat-utilities",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-002", product_id: "app-002",
                image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
                alt_text: "CleanMyMac X", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-002", product_id: "app-002",
                spec_combination: { platform: "Mac" },
                price_amount: 199.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "game-001",
            product_code: "Gis00000003",
            name: "Steam 充值卡 100元",
            subtitle: "Steam 平台充值卡",
            description: "Steam 游戏平台充值卡，可用于购买游戏及DLC",
            product_type: "game_card",
            delivery_type: "cdk",
            category_id: "cat-games",
            is_active: true,
            has_discount: false,
            has_demo_video: false,
            inventory_count: 50,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-003", product_id: "game-001",
                image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
                alt_text: "Steam Card", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-003", product_id: "game-001",
                price_amount: 100.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "physical-001",
            product_code: "Gis00000004",
            name: "Apple Magic Keyboard",
            subtitle: "无线蓝牙键盘",
            description: "Apple 原装无线键盘，支持 Mac 与 iPad，设计精美，手感出色。", 
            product_type: "physical",
            delivery_type: "shipment",
            category_id: "cat-physical",
            is_active: true,
            has_discount: true,
            has_demo_video: false,
            inventory_count: 20,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-004", product_id: "physical-001",
                image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop",
                alt_text: "Magic Keyboard", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-004", product_id: "physical-001",
                spec_combination: { color: "白色" },
                price_amount: 699.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
        {
            id: "app-003",
            product_code: "Gis00000005",
            name: "Figma Pro",
            subtitle: "协作设计工具",
            description: "Figma 是一款基于云端的设计工具，支持团队实时协作设计。",
            product_type: "app",
            delivery_type: "license_key",
            category_id: "cat-design",
            is_active: true,
            has_discount: false,
            has_demo_video: true,
            inventory_count: 999,
            created_at: now,
            updated_at: now,
            images: [{
                id: "img-005", product_id: "app-003",
                image_url: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&h=600&fit=crop",
                alt_text: "Figma Pro", is_primary: true, sort_order: 0, created_at: now,
            }],
            prices: [{
                id: "price-005", product_id: "app-003",
                spec_combination: { platform: "Cross-platform" },
                price_amount: 150.00, currency: "CNY", is_active: true, created_at: now,
            }],
        },
    ];
}

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "搜索 - Gisyit Shop" },
        { name: "description", content: "搜索商品" },
    ];
}

/**
 * Search Page Component
 * Requirements: 4.5, 7.1, 7.2, 7.3, 7.4
 */
export default function SearchPage({ loaderData }: Route.ComponentProps) {
    const { query, products, categories, filters, user, cartItemCount, sections } = loaderData as {
        query: string;
        products: Product[];
        categories: ProductCategory[];
        filters: { productType: ProductType | null; categoryId: string | null };
        user: { email?: string; isLoggedIn: boolean };
        cartItemCount: number;
        sections: StoreSection[];
    };
    const hasQuery = query.trim().length > 0;
    const hasResults = products.length > 0;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-8">
                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold text-text-primary mb-2">搜索商品</h1>
                    <p className="text-text-secondary">在所有商品中搜索</p>
                </div>

                {/* Search Input */}
                <SearchInput defaultValue={query} />

                {/* Filters */}
                <SearchFilters
                    categories={categories}
                    currentType={filters.productType}
                    currentCategory={filters.categoryId}
                    query={query}
                />

                {/* Results */}
                {hasQuery ? (
                    hasResults ? (
                        <div className="space-y-4">
                            <p className="text-text-secondary">
                                找到 <span className="font-medium text-text-primary">{products.length}</span> 个相关商品
                            </p>
                            <ProductGrid products={products} />
                        </div>
                    ) : (
                        <SearchEmptyState query={query} />
                    )
                ) : (
                    <div className="text-center py-16 text-text-muted">
                        <span className="text-4xl mb-4 block">🔍</span>
                        <p className="text-lg">输入关键词开始搜索</p>
                    </div>
                )}
            </div>
        </RootLayout>
    );
}
