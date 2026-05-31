import type { Route } from "./+types/product.$slug";
import { RootLayout } from "~/components/layout";
import { ProductDetail, ProductFiles } from "~/components/product";
import type { SafeProductFile } from "~/components/product/product-files";
import type {
    Product,
    ProductImage,
    ProductPrice,
    ProductSpec,
    ProductSpecOption,
    ProductVideo,
    ProductCategory,
} from "~/lib/supabase/types";
import type { StoreSection } from "~/lib/sections";
import { Button } from "~/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useFetcher, redirect } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "~/components/ui/toast";

// ============================================
// Action Types
// ============================================

type ActionIntent = "free-download" | "buy-now";

interface FreeDownloadFormData {
    intent: "free-download";
    productId: string;
    fileId: string;
}

interface BuyNowFormData {
    intent: "buy-now";
    productId: string;
    priceId: string;
    specCombination: string; // JSON stringified
    quantity: string;
}

// ============================================
// Route Action Handler
// ============================================

/**
 * Product Detail Action Handler
 *
 * Handles form submissions for:
 * - Free product downloads (Requirements: 4.1, 5.2)
 * - Buy now checkout (Requirements: 10.1, 10.3)
 *
 * All actions are processed through server actions to ensure security.
 */
export async function action({ request, params }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent") as ActionIntent;

    if (!intent) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "缺少操作类型" } },
            { status: 400 }
        );
    }

    // Get product ID from form data (since route now uses slug)
    const productId = formData.get("productId") as string;

    switch (intent) {
        case "free-download":
            return handleFreeDownload(request, formData, productId);
        case "buy-now":
            return handleBuyNow(request, formData, productId);
        default:
            return Response.json(
                { success: false, error: { code: "INVALID_REQUEST", message: "无效的操作类型" } },
                { status: 400 }
            );
    }
}

/**
 * Handle free product download
 *
 * Requirements: 4.1, 5.2
 * - Trigger server action to generate signed URL
 * - Process through Remix server action (not direct URL)
 */
async function handleFreeDownload(
    request: Request,
    formData: FormData,
    routeProductId: string | undefined
): Promise<Response> {
    const { processFreeDownload, isValidServerActionRequest } = await import(
        "~/lib/download/free-download.server"
    );

    // Validate request is from a valid server action
    if (!isValidServerActionRequest(request)) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "无效的请求来源" } },
            { status: 400 }
        );
    }

    const productId = formData.get("productId") as string;
    const fileId = formData.get("fileId") as string;

    // Validate productId matches route
    if (routeProductId && productId !== routeProductId) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "商品ID不匹配" } },
            { status: 400 }
        );
    }

    if (!productId || !fileId) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "缺少必要参数" } },
            { status: 400 }
        );
    }

    const result = await processFreeDownload(request, { productId, fileId });

    if (!result.success) {
        return Response.json(
            { success: false, error: result.error },
            { status: 400 }
        );
    }

    // Return signed URL for client to initiate download
    return Response.json({
        success: true,
        url: result.url,
        filename: result.filename,
    });
}

/**
 * Handle buy now checkout
 *
 * Requirements: 10.1, 10.3
 * - Create checkout session with single product
 * - Redirect to Stripe checkout
 */
async function handleBuyNow(
    request: Request,
    formData: FormData,
    routeProductId: string | undefined
): Promise<Response> {
    const { processBuyNow, isValidBuyNowRequest } = await import(
        "~/lib/checkout/buy-now.server"
    );

    // Validate request is from a valid server action
    if (!isValidBuyNowRequest(request)) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "无效的请求来源" } },
            { status: 400 }
        );
    }

    const productId = formData.get("productId") as string;
    const priceId = formData.get("priceId") as string;
    const specCombinationStr = formData.get("specCombination") as string;
    const quantityStr = formData.get("quantity") as string;

    // Validate productId matches route
    if (routeProductId && productId !== routeProductId) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "商品ID不匹配" } },
            { status: 400 }
        );
    }

    if (!productId || !priceId) {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "缺少必要参数" } },
            { status: 400 }
        );
    }

    // Parse spec combination
    let specCombination: Record<string, string> = {};
    try {
        if (specCombinationStr) {
            specCombination = JSON.parse(specCombinationStr);
        }
    } catch {
        return Response.json(
            { success: false, error: { code: "INVALID_REQUEST", message: "规格参数格式错误" } },
            { status: 400 }
        );
    }

    // Parse quantity
    const quantity = parseInt(quantityStr || "1", 10);
    if (isNaN(quantity) || quantity < 1) {
        return Response.json(
            { success: false, error: { code: "INVALID_QUANTITY", message: "购买数量无效" } },
            { status: 400 }
        );
    }

    // Build URLs for Stripe redirect - use slug in cancel URL
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    // Extract slug from current URL path
    const pathParts = url.pathname.split('/');
    const currentSlug = pathParts[pathParts.length - 1];
    const cancelUrl = `${baseUrl}/product/${currentSlug}`;

    const result = await processBuyNow(
        request,
        { productId, priceId, specCombination, quantity },
        { successUrl, cancelUrl }
    );

    if (!result.success) {
        return Response.json(
            { success: false, error: result.error },
            { status: 400 }
        );
    }

    // Return session URL for client to redirect
    return Response.json({
        success: true,
        sessionUrl: result.sessionUrl,
        sessionId: result.sessionId,
    });
}

/**
 * Product Detail Loader
 * 
 * Fetches product with images, specs, prices, videos via Supabase MCP
 * Also fetches product files for app products
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4 - Slug URL routing with redirects
 * - Supports both slug and UUID access
 * - Redirects UUID to slug URL with 301 status
 * - Redirects historical slug to current slug with 301 status
 * - Sets canonical URL to /product/{slug}
 */
export async function loader({ params, request }: Route.LoaderArgs) {
    const { lookupBySlugOrId } = await import("~/lib/slug/slug-lookup.server");
    const { getMCPBridge } = await import("~/lib/supabase/mcp-client.server");
    const { getProductFiles } = await import("~/lib/download/product-files.server");
    const { getUserForHeader } = await import("~/lib/auth/index.server");
    const { getCart } = await import("~/lib/cart/cart-operations.server");
    const { getSections } = await import("~/lib/sections/index.server");

    const slugOrId = params.slug;

    if (!slugOrId) {
        throw new Response("Product identifier is required", { status: 400 });
    }

    // Get user info for header display
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
            // Use slug lookup service (Requirements 2.1, 2.2)
            const lookupResult = await lookupBySlugOrId(slugOrId);

            if (!lookupResult.found) {
                throw new Response("Product not found", { status: 404 });
            }

            // Redirect if accessed by UUID or historical slug (Requirements 2.2, 5.2)
            if (lookupResult.redirectTo) {
                return redirect(`/product/${lookupResult.redirectTo}`, 301);
            }

            const product = lookupResult.product!;

            // Fetch product files for app products or download delivery type
            let productFiles: SafeProductFile[] = [];
            const shouldFetchFiles =
                product.product_type === "app" ||
                product.product_type === "apps" ||
                product.delivery_type === "download";

            if (shouldFetchFiles) {
                const filesResult = await getProductFiles(product.id);
                if (filesResult.data) {
                    productFiles = filesResult.data;
                }
            }

            return {
                product,
                productFiles,
                user,
                cartItemCount,
                sections,
                // Include canonical URL for SEO (Requirement 2.4)
                canonicalUrl: `/product/${product.slug}`,
            };
        }

        // Fallback to mock data when MCP is not available (development)
        const product = await fetchProductDetailMock(slugOrId);

        if (!product) {
            throw new Response("Product not found", { status: 404 });
        }

        // Mock product files for app products in development
        let productFiles: SafeProductFile[] = [];
        if (product.product_type === "app") {
            productFiles = getMockProductFiles(product.id);
        }

        return {
            product,
            productFiles,
            user,
            cartItemCount,
            sections,
            canonicalUrl: `/product/${product.slug || product.id}`,
        };
    } catch (error) {
        console.error("Failed to fetch product:", error);
        if (error instanceof Response) {
            throw error;
        }
        throw new Response("Failed to load product", { status: 500 });
    }
}


/**
 * Get mock product files for development
 */
function getMockProductFiles(productId: string): SafeProductFile[] {
    const now = new Date().toISOString();

    // Only return mock files for the app product
    if (productId === "app-001") {
        return [
            {
                id: "file-001",
                product_id: productId,
                filename: "sketch-pro-v3.0.dmg",
                original_filename: "Sketch Pro v3.0.dmg",
                file_size: 156237824, // ~149 MB
                mime_type: "application/x-apple-diskimage",
                uploaded_at: now,
                updated_at: now,
            },
            {
                id: "file-002",
                product_id: productId,
                filename: "sketch-pro-v3.0-windows.zip",
                original_filename: "Sketch Pro v3.0 Windows.zip",
                file_size: 142606336, // ~136 MB
                mime_type: "application/zip",
                uploaded_at: now,
                updated_at: now,
            },
            {
                id: "file-003",
                product_id: productId,
                filename: "readme.pdf",
                original_filename: "安装说明.pdf",
                file_size: 524288, // 512 KB
                mime_type: "application/pdf",
                uploaded_at: now,
                updated_at: now,
            },
        ];
    }

    return [];
}


/**
 * Fetch product detail mock for development
 * Supports lookup by both slug and ID
 */
async function fetchProductDetailMock(slugOrId: string): Promise<Product | null> {
    const mockProducts = getAllMockProducts();
    // Try to find by slug first, then by ID
    const product = mockProducts.find(p => p.slug === slugOrId || p.id === slugOrId);
    return product || null;
}

/**
 * Get all mock products for development
 * Includes products from all store sections with full relations
 */
function getAllMockProducts(): Product[] {
    const now = new Date().toISOString();

    return [
        // App products
        createMockAppProduct(now),
        // Game products
        createMockGameProduct(now),
        // Physical products
        createMockPhysicalProduct(now),
        // Overseas products
        createMockOverseasProduct(now),
    ];
}


/**
 * Mock app product with full relations
 * Requirements 2.2: Platform compatibility, version, download instructions
 */
function createMockAppProduct(now: string): Product {
    return {
        id: "app-001",
        slug: "sketch-pro",
        product_code: "Gis00000001",
        name: "Sketch Pro",
        subtitle: "专业级矢量设计工具",
        description: `Sketch Pro 是一款专为 Mac 设计的专业矢量图形编辑器。

主要功能
- 强大的矢量编辑工具
- 智能布局和对齐
- 丰富的插件生态
- 团队协作功能

系统要求
- macOS 11.0 或更高版本
- 4GB RAM（推荐 8GB）
- 1GB 可用磁盘空间`,
        product_type: "app",
        delivery_type: "download",
        category_id: "cat-design",
        is_active: true,
        has_discount: true,
        has_demo_video: true,
        inventory_count: 999,
        created_at: now,
        updated_at: now,
        images: [
            {
                id: "img-001-1", product_id: "app-001",
                image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
                alt_text: "Sketch Pro 主界面", is_primary: true, sort_order: 0, created_at: now,
            },
            {
                id: "img-001-2", product_id: "app-001",
                image_url: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop",
                alt_text: "Sketch Pro 工具栏", is_primary: false, sort_order: 1, created_at: now,
            },
        ],
        specs: [
            {
                id: "spec-001-1", product_id: "app-001", spec_name: "平台", sort_order: 0, created_at: now,
                options: [
                    { id: "opt-001-1", spec_id: "spec-001-1", option_value: "Mac", sort_order: 0, created_at: now },
                ],
            },
            {
                id: "spec-001-2", product_id: "app-001", spec_name: "版本", sort_order: 1, created_at: now,
                options: [
                    { id: "opt-001-2", spec_id: "spec-001-2", option_value: "标准版", sort_order: 0, created_at: now },
                    { id: "opt-001-3", spec_id: "spec-001-2", option_value: "Pro 版", sort_order: 1, created_at: now },
                ],
            },
        ],
        prices: [
            {
                id: "price-001-1", product_id: "app-001",
                spec_combination: { "平台": "Mac", "版本": "标准版" },
                price_amount: 299.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-001-2", product_id: "app-001",
                spec_combination: { "平台": "Mac", "版本": "Pro 版" },
                price_amount: 599.00, currency: "CNY", is_active: true, created_at: now,
            },
        ],
        videos: [
            {
                id: "video-001", product_id: "app-001",
                video_url: "https://example.com/sketch-demo.mp4",
                video_type: "demo", sort_order: 0, created_at: now,
            },
        ],
        category: {
            id: "cat-design", name: "设计工具", slug: "design",
            store_section: "apps", sort_order: 0, created_at: now,
        },
    };
}


/**
 * Mock game product with full relations
 * Requirements 2.3: Platform, region restrictions, activation instructions
 */
function createMockGameProduct(now: string): Product {
    return {
        id: "game-001",
        slug: "steam-gift-card",
        product_code: "Gis00000003",
        name: "Steam 充值卡",
        subtitle: "Steam 平台通用充值卡",
        description: `Steam 充值卡可用于 Steam 平台购买游戏、DLC、软件等。

使用说明：
1. 登录 Steam 客户端或网页
2. 点击 "充值 Steam 钱包"
3. 选择"兑换 Steam 钱包充值码"
4. 输入收到的充值码完成充值

注意事项：
- 充值码仅限对应区服使用
- 充值后不可退款
- 请确认账号区服后再购买`,
        product_type: "game_card",
        delivery_type: "cdk",
        category_id: "cat-steam",
        is_active: true,
        has_discount: false,
        has_demo_video: false,
        inventory_count: 50,
        created_at: now,
        updated_at: now,
        images: [
            {
                id: "img-003-1", product_id: "game-001",
                image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
                alt_text: "Steam 充值卡", is_primary: true, sort_order: 0, created_at: now,
            },
        ],
        specs: [
            {
                id: "spec-003-1", product_id: "game-001", spec_name: "区服", sort_order: 0, created_at: now,
                options: [
                    { id: "opt-003-1", spec_id: "spec-003-1", option_value: "国区", sort_order: 0, created_at: now },
                    { id: "opt-003-2", spec_id: "spec-003-1", option_value: "美区", sort_order: 1, created_at: now },
                    { id: "opt-003-3", spec_id: "spec-003-1", option_value: "港区", sort_order: 2, created_at: now },
                ],
            },
            {
                id: "spec-003-2", product_id: "game-001", spec_name: "面额", sort_order: 1, created_at: now,
                options: [
                    { id: "opt-003-4", spec_id: "spec-003-2", option_value: "50元", sort_order: 0, created_at: now },
                    { id: "opt-003-5", spec_id: "spec-003-2", option_value: "100元", sort_order: 1, created_at: now },
                    { id: "opt-003-6", spec_id: "spec-003-2", option_value: "200元", sort_order: 2, created_at: now },
                ],
            },
        ],
        prices: [
            {
                id: "price-003-1", product_id: "game-001",
                spec_combination: { "区服": "国区", "面额": "50元" },
                price_amount: 50.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-003-2", product_id: "game-001",
                spec_combination: { "区服": "国区", "面额": "100元" },
                price_amount: 100.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-003-3", product_id: "game-001",
                spec_combination: { "区服": "国区", "面额": "200元" },
                price_amount: 200.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-003-4", product_id: "game-001",
                spec_combination: { "区服": "美区", "面额": "50元" },
                price_amount: 55.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-003-5", product_id: "game-001",
                spec_combination: { "区服": "港区", "面额": "100元" },
                price_amount: 105.00, currency: "CNY", is_active: true, created_at: now,
            },
        ],
        category: {
            id: "cat-steam", name: "Steam", slug: "steam",
            store_section: "games", sort_order: 0, created_at: now,
        },
    };
}



/**
 * Mock physical product with full relations
 * Requirements 2.4: Shipping information and estimated delivery time
 */
function createMockPhysicalProduct(now: string): Product {
    return {
        id: "physical-001",
        slug: "apple-magic-keyboard",
        product_code: "Gis00000005",
        name: "Apple Magic Keyboard",
        subtitle: "无线蓝牙键盘",
        description: `Apple Magic Keyboard 采用精心设计的低键程按键和剪刀式结构，带来舒适精准的输入体验。

产品特点：
- 可充电锂电池，一次充电可使用约一个月
- 蓝牙无线连接
- 自动配对功能
- 兼容 Mac 与 iPad

包装清单：
- Magic Keyboard 键盘 x 1
- USB-C 转闪电连接线 x 1
- 说明书 x 1`,
        product_type: "physical",
        delivery_type: "shipment",
        category_id: "cat-accessories",
        is_active: true,
        has_discount: false,
        has_demo_video: false,
        inventory_count: 15,
        created_at: now,
        updated_at: now,
        images: [
            {
                id: "img-005-1", product_id: "physical-001",
                image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop",
                alt_text: "Apple Magic Keyboard 正面", is_primary: true, sort_order: 0, created_at: now,
            },
            {
                id: "img-005-2", product_id: "physical-001",
                image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop",
                alt_text: "Apple Magic Keyboard 侧面", is_primary: false, sort_order: 1, created_at: now,
            },
        ],
        specs: [
            {
                id: "spec-005-1", product_id: "physical-001", spec_name: "颜色", sort_order: 0, created_at: now,
                options: [
                    { id: "opt-005-1", spec_id: "spec-005-1", option_value: "银色", sort_order: 0, created_at: now },
                    { id: "opt-005-2", spec_id: "spec-005-1", option_value: "黑色", sort_order: 1, created_at: now },
                ],
            },
            {
                id: "spec-005-2", product_id: "physical-001", spec_name: "布局", sort_order: 1, created_at: now,
                options: [
                    { id: "opt-005-3", spec_id: "spec-005-2", option_value: "标准版", sort_order: 0, created_at: now },
                    { id: "opt-005-4", spec_id: "spec-005-2", option_value: "带数字键版", sort_order: 1, created_at: now },
                ],
            },
        ],
        prices: [
            {
                id: "price-005-1", product_id: "physical-001",
                spec_combination: { "颜色": "银色", "布局": "标准版" },
                price_amount: 699.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-005-2", product_id: "physical-001",
                spec_combination: { "颜色": "银色", "布局": "带数字键版" },
                price_amount: 999.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-005-3", product_id: "physical-001",
                spec_combination: { "颜色": "黑色", "布局": "标准版" },
                price_amount: 749.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-005-4", product_id: "physical-001",
                spec_combination: { "颜色": "黑色", "布局": "带数字键版" },
                price_amount: 1049.00, currency: "CNY", is_active: true, created_at: now,
            },
        ],
        category: {
            id: "cat-accessories", name: "配件", slug: "accessories",
            store_section: "store", sort_order: 0, created_at: now,
        },
    };
}


/**
 * Mock overseas product with full relations
 * Requirements 2.5: Delivery timeline, tax inclusion status, return policy
 */
function createMockOverseasProduct(now: string): Product {
    return {
        id: "overseas-001",
        slug: "nintendo-switch-oled-japan",
        product_code: "Gis00000007",
        name: "日本限定 Nintendo Switch OLED",
        subtitle: "日版限定配色",
        description: `日本限定 Nintendo Switch OLED，采用独特配色设计。

产品规格：
- 7英寸 OLED 屏幕
- 64GB 内置存储
- 支持有线网络连接
- 可调节支架

代购说明：
- 商品从日本直邮
- 预计 7-21 个工作日送达
- 价格已含国际运费
- 可能产生关税（如有将提前告知）

注意事项：
- 日版机器默认日语系统，可切换中文
- 电源适配器为日本规格，需转换插头
- 海外代购商品不支持无理由退换`,
        product_type: "overseas",
        delivery_type: "manual",
        category_id: "cat-japan",
        is_active: true,
        has_discount: false,
        has_demo_video: false,
        inventory_count: 5,
        created_at: now,
        updated_at: now,
        images: [
            {
                id: "img-007-1", product_id: "overseas-001",
                image_url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&h=600&fit=crop",
                alt_text: "Nintendo Switch OLED 日本限定", is_primary: true, sort_order: 0, created_at: now,
            },
            {
                id: "img-007-2", product_id: "overseas-001",
                image_url: "https://images.unsplash.com/photo-1617096200347-cb04ae810b1d?w=800&h=600&fit=crop",
                alt_text: "Nintendo Switch OLED 配件", is_primary: false, sort_order: 1, created_at: now,
            },
        ],
        specs: [
            {
                id: "spec-007-1", product_id: "overseas-001", spec_name: "配色", sort_order: 0, created_at: now,
                options: [
                    { id: "opt-007-1", spec_id: "spec-007-1", option_value: "白色", sort_order: 0, created_at: now },
                    { id: "opt-007-2", spec_id: "spec-007-1", option_value: "红蓝", sort_order: 1, created_at: now },
                    { id: "opt-007-3", spec_id: "spec-007-1", option_value: "限定版", sort_order: 2, created_at: now },
                ],
            },
        ],
        prices: [
            {
                id: "price-007-1", product_id: "overseas-001",
                spec_combination: { "配色": "白色" },
                price_amount: 2599.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-007-2", product_id: "overseas-001",
                spec_combination: { "配色": "红蓝" },
                price_amount: 2599.00, currency: "CNY", is_active: true, created_at: now,
            },
            {
                id: "price-007-3", product_id: "overseas-001",
                spec_combination: { "配色": "限定版" },
                price_amount: 2999.00, currency: "CNY", is_active: true, created_at: now,
            },
        ],
        category: {
            id: "cat-japan", name: "日本", slug: "japan",
            store_section: "overseas", sort_order: 0, created_at: now,
        },
    };
}


export function meta({ data }: Route.MetaArgs) {
    if (!data?.product) {
        return [
            { title: "商品未找到 - Store" },
            { name: "description", content: "商品不存在或已下架" },
        ];
    }

    // Include canonical URL in meta (Requirement 2.4)
    const canonicalUrl = data.canonicalUrl || `/product/${data.product.slug || data.product.id}`;

    return [
        { title: `${data.product.name} - Store` },
        { name: "description", content: data.product.subtitle || data.product.description?.slice(0, 160) },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
    ];
}

/**
 * Get back link based on product type
 */
function getBackLink(productType: string): { href: string; label: string } {
    switch (productType) {
        case "app":
            return { href: "/apps", label: "返回应用商店" };
        case "game_card":
        case "game_cdk":
        case "game_digital":
            return { href: "/games", label: "返回游戏商店" };
        case "physical":
            return { href: "/store", label: "返回实物商店" };
        case "overseas":
            return { href: "/overseas", label: "返回海外代购" };
        default:
            return { href: "/", label: "返回首页" };
    }
}

/**
 * Product Detail Page Component
 * Requirements: 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.5
 * Requirements: 4.1, 5.2 - Free download through server action
 * Requirements: 10.1, 10.3 - Buy now through server action
 */
export default function ProductDetailPage({ loaderData }: Route.ComponentProps) {
    const { product, productFiles, user, cartItemCount: initialCartCount, sections } = loaderData as {
        product: Product;
        productFiles: SafeProductFile[];
        user: { email?: string; isLoggedIn: boolean };
        cartItemCount: number;
        sections: StoreSection[];
    };
    const backLink = getBackLink(product.product_type);
    const cartFetcher = useFetcher();
    const downloadFetcher = useFetcher();
    const buyNowFetcher = useFetcher();
    const [cartItemCount, setCartItemCount] = useState(initialCartCount || 0);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    // Update cart count when fetcher returns
    useEffect(() => {
        if (cartFetcher.data && cartFetcher.data.success) {
            setCartItemCount(cartFetcher.data.itemCount || 0);
            toast.success("商品已添加到购物车");
        } else if (cartFetcher.data?.error) {
            toast.error(cartFetcher.data.error.message || "添加失败");
        }
    }, [cartFetcher.data]);

    // Handle free download response
    // Requirements: 4.1, 4.5 - Initiate file download or redirect to signed URL
    useEffect(() => {
        if (downloadFetcher.data) {
            if (downloadFetcher.data.success && downloadFetcher.data.url) {
                setDownloadError(null);
                // Initiate download by opening the signed URL
                window.open(downloadFetcher.data.url, "_blank");
                toast.success("下载已开启");
            } else if (downloadFetcher.data.error) {
                setDownloadError(downloadFetcher.data.error.message || "下载失败");
                toast.error(downloadFetcher.data.error.message || "下载失败");
            }
        }
    }, [downloadFetcher.data]);

    // Handle buy now response
    // Requirements: 10.3 - Redirect to Stripe checkout
    useEffect(() => {
        if (buyNowFetcher.data) {
            if (buyNowFetcher.data.success && buyNowFetcher.data.sessionUrl) {
                // Redirect to Stripe checkout
                window.location.href = buyNowFetcher.data.sessionUrl;
            } else if (buyNowFetcher.data.error) {
                toast.error(buyNowFetcher.data.error.message || "创建支付会话失败");
            }
        }
    }, [buyNowFetcher.data]);

    const handleAddToCart = (specCombination: Record<string, string>) => {
        // Find the price for the selected spec combination
        const price = product.prices?.find((p) => {
            if (!p.spec_combination && Object.keys(specCombination).length === 0) {
                return true;
            }
            if (!p.spec_combination) return false;
            return Object.entries(specCombination).every(
                ([key, value]) => p.spec_combination?.[key] === value
            );
        });

        if (!price) {
            console.error("No price found for spec combination:", specCombination);
            return;
        }

        // Submit to cart API
        cartFetcher.submit(
            {
                intent: "add",
                productId: product.id,
                priceId: price.id,
                specCombination: JSON.stringify(specCombination),
                quantity: "1",
                snapshotPrice: String(price.price_amount),
                snapshotCurrency: price.currency,
            },
            {
                method: "POST",
                action: "/api/cart",
            }
        );
    };

    /**
     * Handle buy now action
     * Requirements: 10.1, 10.2, 10.3
     * - Create checkout session with selected spec combination
     * - Redirect to Stripe checkout
     */
    const handleBuyNow = (specCombination: Record<string, string>, priceId: string) => {
        buyNowFetcher.submit(
            {
                intent: "buy-now",
                productId: product.id,
                priceId,
                specCombination: JSON.stringify(specCombination),
                quantity: "1",
            },
            {
                method: "POST",
            }
        );
    };

    /**
     * Handle free download action
     * Requirements: 4.1, 5.2
     * - Trigger server action to generate signed URL
     * - Process through Remix server action
     */
    const handleFreeDownload = () => {
        // For free products, we need to get the first file to download
        // In a real scenario, this might show a file picker if multiple files exist
        const firstFile = productFiles?.[0];
        if (!firstFile) {
            setDownloadError("没有可下载的文件");
            return;
        }

        setDownloadError(null);
        downloadFetcher.submit(
            {
                intent: "free-download",
                productId: product.id,
                fileId: firstFile.id,
            },
            {
                method: "POST",
            }
        );
    };

    const isAddingToCart = cartFetcher.state === "submitting";
    const isDownloading = downloadFetcher.state === "submitting";
    const isBuyingNow = buyNowFetcher.state === "submitting";

    // Check if this is an app product or download delivery type with files
    const isAppProduct = product.product_type === "app" || product.product_type === "apps" || product.delivery_type === "download";
    const hasFiles = productFiles && productFiles.length > 0;

    return (
        <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
            <div className="space-y-6">
                {/* Back Navigation */}
                <a
                    href={backLink.href}
                    className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {backLink.label}
                </a>

                {/* Product Detail */}
                <ProductDetail
                    product={product}
                    onAddToCart={handleAddToCart}
                    onBuyNow={handleBuyNow}
                    onFreeDownload={handleFreeDownload}
                    isAddingToCart={isAddingToCart}
                    isBuyingNow={isBuyingNow}
                    isDownloading={isDownloading}
                    downloadError={downloadError}
                />

                {/* Product Files Section - Only for app products with files */}
                {isAppProduct && hasFiles && (
                    <div className="border-t border-border pt-6">
                        <ProductFiles
                            files={productFiles}
                            isPurchased={product.is_free === true}
                            productId={product.id}
                            isFreeProduct={product.is_free === true}
                        />
                    </div>
                )}
            </div>
        </RootLayout>
    );
}

/**
 * Error Boundary for Product Detail Page
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const is404 = error instanceof Response && error.status === 404;

    return (
        <RootLayout cartItemCount={0}>
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <AlertCircle className="h-16 w-16 text-text-muted" />
                <h1 className="text-2xl font-bold text-text-primary">
                    {is404 ? "商品未找到" : "加载失败"}
                </h1>
                <p className="text-text-secondary text-center max-w-md">
                    {is404
                        ? "您访问的商品不存在或已下架，请返回继续浏览其他商品。"
                        : "加载商品信息时出现错误，请稍后重试。"}
                </p>
                <div className="flex gap-3">
                    <Button variant="outline" asChild>
                        <a href="/">返回首页</a>
                    </Button>
                    <Button asChild>
                        <a href="/apps">浏览应用</a>
                    </Button>
                </div>
            </div>
        </RootLayout>
    );
}

