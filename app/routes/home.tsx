import type { Route } from "./+types/home";
import { RootLayout } from "~/components/layout";
import { Hero, TodayCardGrid, Shelf } from "~/components/home";
import type { Product, StoreSection } from "~/lib/supabase/types";

/**
 * Homepage Loader
 * Fetches featured products via Supabase MCP for Hero, TodayCards, and Shelf sections
 * Requirements: 1.1 - Uses GET method via MCP to fetch product data
 * Requirements: 4.5 - Display account status in header
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Dynamic imports for server-only modules
  const { getFeaturedProducts } = await import("~/lib/product/index.server");
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
      const result = await getFeaturedProducts();
      return { ...result, user, cartItemCount, sections };
    }

    // Fallback to mock data when MCP is not available (development)
    const productsResponse = getMockProducts();

    // Organize products by section for display
    const featuredProduct = productsResponse.find(p => p.has_discount) || productsResponse[0];
    const todayProducts = productsResponse.slice(0, 6);

    // Group products by store section for shelves
    const appProducts = productsResponse.filter(p => p.product_type === 'app');
    const gameProducts = productsResponse.filter(p =>
      ['game_card', 'game_cdk', 'game_digital'].includes(p.product_type)
    );
    const physicalProducts = productsResponse.filter(p => p.product_type === 'physical');
    const overseasProducts = productsResponse.filter(p => p.product_type === 'overseas');

    return {
      featuredProduct,
      todayProducts,
      shelves: [
        { title: "热门应用", products: appProducts, viewAllLink: "/apps", section: "apps" as StoreSection },
        {
          title: "精选游戏", products: gameProducts, viewAllLink: "/games", section: "games" as StoreSection },
        { title: "实物商品", products: physicalProducts, viewAllLink: "/store", section: "store" as StoreSection },
        { title: "海外代购", products: overseasProducts, viewAllLink: "/overseas", section: "overseas" as StoreSection },
      ].filter(shelf => shelf.products.length > 0),
      user,
      cartItemCount,
      sections,
    };
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return {
      featuredProduct: undefined,
      todayProducts: [],
      shelves: [],
      user,
      cartItemCount,
      sections,
    };
  }
}

/**
 * Mock products for development
 * These will be replaced with real data from Supabase MCP
 */
function getMockProducts(): Product[] {
  const now = new Date().toISOString();

  return [
    // Featured App
    {
      id: "app-001",
      product_code: "Gis00000001",
      name: "Sketch Pro",
      subtitle: "专业级矢量设计工具",
      description: "Sketch Pro 是一款专为 Mac 设计的专业矢量图形编辑器，适用于 UI/UX 设计、图标设计和原型制作。",
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
          id: "img-001",
          product_id: "app-001",
          image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
          alt_text: "Sketch Pro 界面",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-001",
          product_id: "app-001",
          spec_combination: { platform: "Mac" },
          price_amount: 299.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // App 2
    {
      id: "app-002",
      product_code: "Gis00000002",
      name: "CleanMyMac X",
      subtitle: "Mac 系统优化清理工具",
      description: "一键清理系统垃圾，优化 Mac 性能。",
      product_type: "app",
      delivery_type: "license_key",
      category_id: "cat-utilities",
      is_active: true,
      has_discount: false,
      has_demo_video: false,
      inventory_count: 999,
      created_at: now,
      updated_at: now,
      images: [
        {
          id: "img-002",
          product_id: "app-002",
          image_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
          alt_text: "CleanMyMac X",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-002",
          product_id: "app-002",
          spec_combination: { platform: "Mac" },
          price_amount: 199.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Game 1
    {
      id: "game-001",
      product_code: "Gis00000003",
      name: "Steam 充值卡 100元",
      subtitle: "Steam 平台通用充值卡",
      description: "可用于 Steam 平台购买游戏和内购。", 
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
          id: "img-003",
          product_id: "game-001",
          image_url: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop",
          alt_text: "Steam 充值卡",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-003",
          product_id: "game-001",
          price_amount: 100.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Game 2 - CDK
    {
      id: "game-002",
      product_code: "Gis00000004",
      name: "艾尔登法环 Steam CDK",
      subtitle: "开放世界动作RPG",
      description: "FromSoftware 与乔治·R·R·马丁联合打造的史诗级动作RPG。", 
      product_type: "game_cdk",
      delivery_type: "cdk",
      category_id: "cat-action",
      is_active: true,
      has_discount: true,
      has_demo_video: true,
      inventory_count: 20,
      created_at: now,
      updated_at: now,
      images: [
        {
          id: "img-004",
          product_id: "game-002",
          image_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop",
          alt_text: "艾尔登法环",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-004",
          product_id: "game-002",
          spec_combination: { region: "国区" },
          price_amount: 298.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Physical Product 1
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
      images: [
        {
          id: "img-005",
          product_id: "physical-001",
          image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop",
          alt_text: "Magic Keyboard",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-005",
          product_id: "physical-001",
          spec_combination: { color: "银色" },
          price_amount: 999.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Physical Product 2
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
      images: [
        {
          id: "img-006",
          product_id: "physical-002",
          image_url: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&h=600&fit=crop",
          alt_text: "AirPods Pro 2",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-006",
          product_id: "physical-002",
          price_amount: 1899.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Overseas Product 1
    {
      id: "overseas-001",
      product_code: "Gis00000007",
      name: "日本限定 Nintendo Switch OLED",
      subtitle: "日版限定配色",
      description: "日本限定发售的 Nintendo Switch OLED 特别版，含日本直邮服务。", 
      product_type: "overseas",
      delivery_type: "shipment",
      category_id: "cat-japan",
      is_active: true,
      has_discount: false,
      has_demo_video: false,
      inventory_count: 5,
      created_at: now,
      updated_at: now,
      images: [
        {
          id: "img-007",
          product_id: "overseas-001",
          image_url: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=800&h=600&fit=crop",
          alt_text: "Nintendo Switch OLED",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-007",
          product_id: "overseas-001",
          price_amount: 2999.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
    // Overseas Product 2
    {
      id: "overseas-002",
      product_code: "Gis00000008",
      name: "韩国代购 Samsung Galaxy Z Fold5",
      subtitle: "韩版折叠屏旗舰机",
      description: "韩国直邮 Samsung Galaxy Z Fold5，支持 5G 网络。",
      product_type: "overseas",
      delivery_type: "shipment",
      category_id: "cat-korea",
      is_active: true,
      has_discount: false,
      has_demo_video: false,
      inventory_count: 3,
      created_at: now,
      updated_at: now,
      images: [
        {
          id: "img-008",
          product_id: "overseas-002",
          image_url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&h=600&fit=crop",
          alt_text: "Galaxy Z Fold5",
          is_primary: true,
          sort_order: 0,
          created_at: now,
        },
      ],
      prices: [
        {
          id: "price-008",
          product_id: "overseas-002",
          price_amount: 12999.00,
          currency: "CNY",
          is_active: true,
          created_at: now,
        },
      ],
    },
  ];
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Gisyit Shop - 综合商业平台" },
    { name: "description", content: "应用、游戏、实物商品、海外代购" },
  ];
}

/**
 * Homepage Component
 * Renders Hero, TodayCards, and Shelf sections with fetched products
 * Requirements: 1.1, 4.5
 */
export default function Home({ loaderData }: Route.ComponentProps) {
  const { featuredProduct, todayProducts, shelves, user, cartItemCount, sections } = loaderData;

  return (
    <RootLayout cartItemCount={cartItemCount} user={user} sections={sections}>
      <div className="space-y-10 md:space-y-12">
        {/* Hero Section - Featured Product */}
        <Hero featuredProduct={featuredProduct} />

        {/* Today Cards Section */}
        {todayProducts.length > 0 && (
          <section>
            <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-6">
              今日推荐
            </h2>
            <TodayCardGrid products={todayProducts} />
          </section>
        )}

        {/* Categorized Shelf Sections */}
        {shelves.map((shelf) => (
          <Shelf
            key={shelf.section}
            title={shelf.title}
            products={shelf.products}
            viewAllLink={shelf.viewAllLink}
          />
        ))}

        {/* Empty State - When no products available */}
        {!featuredProduct && todayProducts.length === 0 && shelves.length === 0 && (
          <section className="text-center py-16">
            <div className="text-6xl mb-4">🏪</div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              商品即将上架
            </h2>
            <p className="text-text-secondary">
              我们正在准备精选商品，敬请期待！            </p>
          </section>
        )}
      </div>
    </RootLayout>
  );
}
