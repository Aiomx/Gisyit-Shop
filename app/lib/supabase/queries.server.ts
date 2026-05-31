/**
 * Type-Safe Query Builders for Supabase MCP
 * 
 * These functions build structured queries that can be executed via MCP.
 * They provide a type-safe interface for common data operations.
 */

import type {
    Product,
    ProductCategory,
    ProductImage,
    ProductPrice,
    ProductSpec,
    ProductVideo,
    Cart,
    CartItem,
    Order,
    OrderItem,
    ProductQuery,
    CartQuery,
    ProductType,
    StoreSection,
} from "./types";

// ============================================
// Product Queries
// ============================================

/**
 * Build a query to fetch products with optional filters
 */
export function buildProductQuery(options: ProductQuery = {}) {
    const filters: Record<string, unknown> = {
        is_active: options.is_active ?? true,
    };

    if (options.type) {
        filters.product_type = options.type;
    }

    if (options.category_id) {
        filters.category_id = options.category_id;
    }

    return {
        table: "products" as const,
        columns: "*",
        filter: filters,
        limit: options.limit,
        offset: options.offset,
    };
}

/**
 * Build a query to fetch products by store section
 */
export function buildProductsBySectionQuery(
    section: StoreSection,
    options: Omit<ProductQuery, "store_section"> = {}
) {
    // Map store sections to product types
    const sectionToTypes: Record<StoreSection, ProductType[]> = {
        apps: ["app"],
        games: ["game_card", "game_cdk", "game_digital"],
        store: ["physical"],
        overseas: ["overseas"],
    };

    const types = sectionToTypes[section];

    return {
        table: "products" as const,
        section,
        productTypes: types,
        filter: {
            is_active: options.is_active ?? true,
            ...(options.category_id && { category_id: options.category_id }),
        },
        limit: options.limit,
        offset: options.offset,
    };
}

/**
 * Build a query to fetch a single product by ID with all relations
 */
export function buildProductDetailQuery(productId: string) {
    return {
        table: "products" as const,
        id: productId,
        select: `
      *,
      images:product_images(*),
      prices:product_prices(*),
      specs:product_specs(*, options:product_spec_options(*)),
      videos:product_videos(*),
      category:product_categories(*)
    `,
    };
}

/**
 * Build a query to search products
 */
export function buildProductSearchQuery(
    searchTerm: string,
    options: Omit<ProductQuery, "search"> = {}
) {
    return {
        table: "products" as const,
        search: searchTerm,
        searchColumns: ["name", "description"],
        filter: {
            is_active: options.is_active ?? true,
            ...(options.type && { product_type: options.type }),
            ...(options.category_id && { category_id: options.category_id }),
        },
        limit: options.limit ?? 20,
        offset: options.offset,
    };
}

// ============================================
// Category Queries
// ============================================

/**
 * Build a query to fetch categories by store section
 */
export function buildCategoriesQuery(section?: StoreSection) {
    return {
        table: "product_categories" as const,
        filter: section ? { store_section: section } : {},
        order: { column: "sort_order", ascending: true },
    };
}


// ============================================
// Cart Queries
// ============================================

/**
 * Build a query to fetch cart by user or session
 */
export function buildCartQuery(options: CartQuery) {
    const filters: Record<string, unknown> = {
        status: options.status ?? "active",
    };

    if (options.user_id) {
        filters.user_id = options.user_id;
    } else if (options.session_id) {
        filters.session_id = options.session_id;
    }

    return {
        table: "carts" as const,
        filter: filters,
        select: `
      *,
      items:cart_items(
        *,
        product:products(id, name, product_type, delivery_type, images:product_images(image_url, is_primary))
      )
    `,
    };
}

/**
 * Build data for creating a new cart
 */
export function buildCreateCartData(options: {
    user_id?: string;
    session_id?: string;
}) {
    return {
        table: "carts" as const,
        data: {
            user_id: options.user_id ?? null,
            session_id: options.session_id ?? null,
            status: "active" as const,
        },
    };
}

/**
 * Build data for adding an item to cart
 * Includes price snapshot as required by Requirements 3.1
 */
export function buildAddToCartData(options: {
    cart_id: string;
    product_id: string;
    price_id: string;
    spec_combination?: Record<string, string>;
    quantity: number;
    snapshot_price: number;
    snapshot_currency: string;
}) {
    return {
        table: "cart_items" as const,
        data: {
            cart_id: options.cart_id,
            product_id: options.product_id,
            price_id: options.price_id,
            spec_combination: options.spec_combination ?? null,
            quantity: options.quantity,
            snapshot_price: options.snapshot_price,
            snapshot_currency: options.snapshot_currency,
        },
    };
}

/**
 * Build data for updating cart item quantity
 */
export function buildUpdateCartItemData(
    cartItemId: string,
    quantity: number
) {
    return {
        table: "cart_items" as const,
        id: cartItemId,
        data: {
            quantity,
            updated_at: new Date().toISOString(),
        },
    };
}

/**
 * Build query to check if product already exists in cart
 */
export function buildCartItemExistsQuery(
    cartId: string,
    productId: string,
    priceId: string
) {
    return {
        table: "cart_items" as const,
        filter: {
            cart_id: cartId,
            product_id: productId,
            price_id: priceId,
        },
    };
}

// ============================================
// Order Queries (Read-only for Store)
// ============================================

/**
 * Build a query to fetch order by ID
 */
export function buildOrderQuery(orderId: string) {
    return {
        table: "orders" as const,
        id: orderId,
        select: `
      *,
      items:order_items(*)
    `,
    };
}

/**
 * Build a query to fetch orders by user
 */
export function buildUserOrdersQuery(
    userId: string,
    options: { limit?: number; offset?: number } = {}
) {
    return {
        table: "orders" as const,
        filter: { user_id: userId },
        order: { column: "created_at", ascending: false },
        limit: options.limit ?? 10,
        offset: options.offset,
    };
}

// ============================================
// Price Queries
// ============================================

/**
 * Build a query to fetch active prices for a product
 */
export function buildProductPricesQuery(productId: string) {
    return {
        table: "product_prices" as const,
        filter: {
            product_id: productId,
            is_active: true,
        },
    };
}

/**
 * Build a query to fetch a specific price by ID
 */
export function buildPriceQuery(priceId: string) {
    return {
        table: "product_prices" as const,
        filter: { id: priceId },
    };
}

// ============================================
// Utility Types for Query Results
// ============================================

export type ProductWithRelations = Product & {
    images?: ProductImage[];
    prices?: ProductPrice[];
    specs?: (ProductSpec & { options?: import("./types").ProductSpecOption[] })[];
    videos?: ProductVideo[];
    category?: ProductCategory;
};

export type CartWithItems = Cart & {
    items?: (CartItem & {
        product?: Product & {
            images?: ProductImage[];
        };
    })[];
};

export type OrderWithItems = Order & {
    items?: OrderItem[];
};
