/**
 * Brand Library Index
 * 
 * Exports all brand-related functions for the store frontend.
 * 
 * Requirements: 3.1
 */

// Re-export all brand query functions
export {
    getActiveBrands,
    getBrandBySlug,
    getBrandProducts,
    searchBrands,
    getBrandsGrouped,
    type QueryResponse,
    type BrandWithProductCount,
} from "./brand-queries.server";
