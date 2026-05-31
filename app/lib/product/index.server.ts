/**
 * Product Server Exports
 *
 * This file exports server-only product query functions.
 * Import from "~/lib/product/index.server" in server-side code (loaders, actions).
 */

// Re-export client-safe utilities
export {
    SECTION_PRODUCT_TYPES,
    getProductTypesForSection,
    isProductInSection,
    filterProductsBySection,
    filterProductsBySectionAndCategory,
    getSectionForProductType,
    validateProductsInSection,
} from "./index";

// Export server-only query functions
export {
    getProducts,
    getProductById,
    getProductsBySection,
    getProductsByCategory,
    getCategoryBySlug,
    searchProducts,
    getCategories,
    getFeaturedProducts,
    type ProductQueryOptions,
} from "./product-queries.server";
