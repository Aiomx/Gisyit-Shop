/**
 * Supabase MCP Type Definitions
 * 
 * These types define the data structures used when interacting with
 * Supabase MCP for the Store frontend.
 */

// ============================================
// Product Types
// ============================================

export type ProductType =
    | "app"
    | "game_card"
    | "game_cdk"
    | "game_digital"
    | "physical"
    | "overseas";

export type DeliveryType =
    | "download"
    | "license_key"
    | "cdk"
    | "shipment"
    | "manual";

export type StoreSection = "apps" | "games" | "store" | "overseas";

export interface Product {
    id: string;
    product_code: string;
    name: string;
    /** URL-friendly unique identifier for the product */
    slug?: string;
    subtitle?: string;
    description?: string;
    product_type: ProductType;
    delivery_type: DeliveryType;
    category_id: string;
    is_active: boolean;
    has_discount: boolean;
    has_demo_video: boolean;
    inventory_count?: number;
    /** Whether this product is free (no payment required) */
    is_free?: boolean;
    /** Whether login is required to download free products */
    require_login?: boolean;
    /** Whether this product has been verified (safe, virus-free, open-source) */
    is_verified?: boolean;
    /** Markdown formatted detailed product description */
    detail_content?: string;
    created_at: string;
    updated_at: string;
    // Relations
    images?: ProductImage[];
    prices?: ProductPrice[];
    specs?: ProductSpec[];
    videos?: ProductVideo[];
    category?: ProductCategory;
}

export interface ProductCategory {
    id: string;
    name: string;
    slug: string;
    parent_id?: string;
    store_section: StoreSection;
    sort_order: number;
    created_at: string;
}

export interface ProductImage {
    id: string;
    product_id: string;
    image_url: string;
    alt_text?: string;
    is_primary: boolean;
    sort_order: number;
    created_at: string;
}

export interface ProductSpec {
    id: string;
    product_id: string;
    spec_name: string;
    sort_order: number;
    created_at: string;
    options?: ProductSpecOption[];
}

export interface ProductSpecOption {
    id: string;
    spec_id: string;
    option_value: string;
    sort_order: number;
    created_at: string;
}

export interface ProductPrice {
    id: string;
    product_id: string;
    spec_combination?: Record<string, string>;
    price_amount: number;
    currency: string;
    is_active: boolean;
    created_at: string;
}

export interface ProductVideo {
    id: string;
    product_id: string;
    video_url: string;
    video_type: "demo" | "trailer";
    sort_order: number;
    created_at: string;
}

/**
 * Product file entity for downloadable content
 *
 * Represents a downloadable file associated with an app product.
 * Files are stored in Supabase Storage with metadata in the database.
 *
 * Table: product_files
 * Requirements: 1.3, 6.2
 */
export interface ProductFile {
    id: string;
    product_id: string;
    filename: string;           // Storage filename (may include unique suffix)
    original_filename: string;  // Original filename (used for download)
    file_size: number;          // File size in bytes
    mime_type: string;          // MIME type (e.g., 'application/zip')
    storage_path: string;       // Supabase Storage path
    uploaded_at: string;        // ISO timestamp
    updated_at: string;         // ISO timestamp
}

// ============================================
// Cart Types
// ============================================

export type CartStatus = "active" | "checked_out";

export interface Cart {
    id: string;
    user_id?: string;
    session_id?: string;
    status: CartStatus;
    created_at: string;
    updated_at: string;
    items?: CartItem[];
}

export interface CartItem {
    id: string;
    cart_id: string;
    product_id: string;
    price_id: string;
    spec_combination?: Record<string, string>;
    quantity: number;
    snapshot_price: number;
    snapshot_currency: string;
    created_at: string;
    updated_at: string;
    // Relations
    product?: Product;
}

// ============================================
// Order Types
// ============================================

/**
 * Order status values
 * 
 * - pending: Newly created, awaiting payment (15-minute window)
 * - created: Legacy status (deprecated, use pending)
 * - pending_payment: Legacy status (deprecated, use pending)
 * - paid: Payment successful
 * - cancelled: Expired or manually cancelled
 * - fulfilled: Order fulfilled (digital delivery or shipped)
 * - completed: Order completed
 */
export type OrderStatus =
    | "pending"           // NEW: Initial state for pending orders
    | "created"           // Legacy
    | "pending_payment"   // Legacy
    | "paid"
    | "fulfilled"
    | "completed"
    | "cancelled";

/**
 * Order entity
 * 
 * Represents a customer order with payment tracking.
 * Supports both authenticated users (user_id) and guest checkout (anonymous_session_id).
 * 
 * Table: orders
 * Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 5.3
 */
export interface Order {
    id: string;
    order_number: string;
    /** User ID for authenticated users. Null for guest checkout. */
    user_id?: string;
    /** Session ID for guest checkout. Used when user_id is null. */
    anonymous_session_id?: string;
    cart_id?: string;
    status: OrderStatus;
    total_amount: number;
    currency: string;
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
    created_at: string;
    /** Payment deadline. Order auto-cancels if not paid by this time. Set to created_at + 15 minutes. */
    expires_at?: string;
    /** Timestamp when payment was successfully completed via Stripe webhook. */
    payment_completed_at?: string;
    updated_at: string;
    items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_code: string;
    product_name: string;
    spec_combination?: Record<string, string>;
    quantity: number;
    price: number;
    currency: string;
    created_at: string;
}

// ============================================
// Stripe Event Types (for idempotency)
// ============================================

/**
 * Stripe Event record for idempotent webhook processing
 * Requirements: 10.1, 10.2, 10.3
 */
export interface StripeEvent {
    id: string;
    event_id: string;  // Stripe event.id (unique)
    event_type: string;
    processed_at: string;
    payload?: Record<string, unknown>;
}

// ============================================
// Query Types
// ============================================

export interface ProductQuery {
    type?: ProductType;
    category_id?: string;
    store_section?: StoreSection;
    platform?: string;
    search?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
}

export interface CartQuery {
    user_id?: string;
    session_id?: string;
    status?: CartStatus;
}

// ============================================
// Brand Types
// Requirements: 1.1, 3.1
// ============================================

/**
 * Brand group classification
 * 
 * - os: Operating systems (Mac, Windows, Linux)
 * - platform: Platforms (Steam, Epic, etc.)
 * - store: Stores (App Store, Google Play, etc.)
 * - other: Other classifications
 */
export type BrandGroup = "os" | "platform" | "store" | "other";

/**
 * Brand entity
 * 
 * Represents a platform or brand classification for products.
 * Examples: Mac, Windows, Linux, Steam, etc.
 * 
 * Table: brands
 * Requirements: 1.1, 3.1
 */
export interface Brand {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
    brand_group: BrandGroup;
    sort_order: number;
    is_active: boolean;
    description?: string;
    created_at: string;
    updated_at: string;
}

/**
 * Product-Brand association
 * Requirements: 2.1
 */
export interface ProductBrand {
    id: string;
    product_id: string;
    brand_id: string;
    created_at: string;
}

// ============================================
// Stripe Event Types (for idempotency)
// ============================================

/**
 * Stripe Event record for idempotent webhook processing
 * 
 * Table: stripe_events
 * Purpose: Track processed Stripe webhook events to prevent duplicate processing
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
export interface StripeEvent {
    id: string;
    event_id: string;      // Stripe event.id (unique)
    event_type: string;    // Stripe event type (e.g., 'payment_intent.succeeded')
    processed_at: string;  // ISO timestamp when event was processed
    payload?: unknown;     // Optional: full event payload for debugging
}

// ============================================
// Download Log Types
// Requirements: 6.3, 8.1
// ============================================

/**
 * Download log entry for free product downloads
 * 
 * Tracks free product downloads separately from orders.
 * Used for analytics and audit purposes.
 * 
 * Table: download_logs
 * Requirements: 6.3, 6.4, 6.5, 8.1, 8.2
 */
export interface DownloadLog {
    id: string;
    product_id: string;
    file_id: string;
    /** User ID for authenticated users */
    user_id?: string;
    /** Session ID for anonymous users */
    session_id?: string;
    /** IP address of the downloader */
    ip_address?: string;
    /** Timestamp when download was initiated */
    downloaded_at: string;
}

// ============================================
// Slug History Types
// Requirements: 5.1, 5.4
// ============================================

/**
 * Slug history entry for 301 redirect support
 * 
 * When a product's slug is changed, the old slug is stored here
 * to enable 301 redirects from old URLs to new URLs.
 * 
 * Table: slug_history
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export interface SlugHistory {
    id: string;
    product_id: string;
    old_slug: string;
    created_at: string;
}
