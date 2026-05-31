/**
 * Product Detail Type-Specific Fields Utilities
 * 
 * This module provides functions for determining which fields should be
 * displayed for each product type on the product detail page.
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */

import type { Product, ProductType } from "~/lib/supabase/types";

/**
 * Required fields for each product type on the detail page
 * 
 * - app: platform compatibility, version info, download/license instructions
 * - game_*: platform, region restrictions, activation instructions
 * - physical: shipping information, estimated delivery time
 * - overseas: delivery timeline, tax inclusion status, return policy
 */
export interface TypeSpecificFields {
    /** Whether platform compatibility should be displayed */
    showPlatformCompatibility: boolean;
    /** Whether delivery/download instructions should be displayed */
    showDeliveryInstructions: boolean;
    /** Whether region restrictions should be displayed */
    showRegionRestrictions: boolean;
    /** Whether activation instructions should be displayed */
    showActivationInstructions: boolean;
    /** Whether shipping information should be displayed */
    showShippingInfo: boolean;
    /** Whether estimated delivery time should be displayed */
    showEstimatedDelivery: boolean;
    /** Whether tax inclusion status should be displayed */
    showTaxStatus: boolean;
    /** Whether return policy should be displayed */
    showReturnPolicy: boolean;
}

/**
 * Get the required type-specific fields for a product type
 * 
 * @param productType - The product type
 * @returns Object indicating which fields should be displayed
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
export function getTypeSpecificFields(productType: ProductType): TypeSpecificFields {
    switch (productType) {
        // Requirement 2.2: App products
        case "app":
            return {
                showPlatformCompatibility: true,
                showDeliveryInstructions: true,
                showRegionRestrictions: false,
                showActivationInstructions: false,
                showShippingInfo: false,
                showEstimatedDelivery: false,
                showTaxStatus: false,
                showReturnPolicy: false,
            };

        // Requirement 2.3: Game products
        case "game_card":
        case "game_cdk":
        case "game_digital":
            return {
                showPlatformCompatibility: false,
                showDeliveryInstructions: true,
                showRegionRestrictions: true,
                showActivationInstructions: true,
                showShippingInfo: false,
                showEstimatedDelivery: false,
                showTaxStatus: false,
                showReturnPolicy: false,
            };

        // Requirement 2.4: Physical products
        case "physical":
            return {
                showPlatformCompatibility: false,
                showDeliveryInstructions: false,
                showRegionRestrictions: false,
                showActivationInstructions: false,
                showShippingInfo: true,
                showEstimatedDelivery: true,
                showTaxStatus: false,
                showReturnPolicy: true,
            };

        // Requirement 2.5: Overseas products
        case "overseas":
            return {
                showPlatformCompatibility: false,
                showDeliveryInstructions: false,
                showRegionRestrictions: false,
                showActivationInstructions: false,
                showShippingInfo: false,
                showEstimatedDelivery: true,
                showTaxStatus: true,
                showReturnPolicy: true,
            };

        default:
            // Default: no type-specific fields
            return {
                showPlatformCompatibility: false,
                showDeliveryInstructions: false,
                showRegionRestrictions: false,
                showActivationInstructions: false,
                showShippingInfo: false,
                showEstimatedDelivery: false,
                showTaxStatus: false,
                showReturnPolicy: false,
            };
    }
}

/**
 * Validate that a product has the required fields displayed based on its type
 * 
 * @param product - The product to validate
 * @param displayedFields - The fields that are actually displayed
 * @returns true if all required fields for the product type are displayed
 */
export function validateTypeSpecificFieldsDisplayed(
    product: Product,
    displayedFields: TypeSpecificFields
): boolean {
    const requiredFields = getTypeSpecificFields(product.product_type);

    // Check that all required fields are displayed
    // A field is "correctly displayed" if:
    // - It's required and displayed, OR
    // - It's not required (we don't care if it's displayed or not)
    return (
        (!requiredFields.showPlatformCompatibility || displayedFields.showPlatformCompatibility) &&
        (!requiredFields.showDeliveryInstructions || displayedFields.showDeliveryInstructions) &&
        (!requiredFields.showRegionRestrictions || displayedFields.showRegionRestrictions) &&
        (!requiredFields.showActivationInstructions || displayedFields.showActivationInstructions) &&
        (!requiredFields.showShippingInfo || displayedFields.showShippingInfo) &&
        (!requiredFields.showEstimatedDelivery || displayedFields.showEstimatedDelivery) &&
        (!requiredFields.showTaxStatus || displayedFields.showTaxStatus) &&
        (!requiredFields.showReturnPolicy || displayedFields.showReturnPolicy)
    );
}

/**
 * Get the info section title for a product type
 * 
 * @param productType - The product type
 * @returns The title for the type-specific info section
 */
export function getInfoSectionTitle(productType: ProductType): string {
    switch (productType) {
        case "app":
            return "应用信息";
        case "game_card":
        case "game_cdk":
        case "game_digital":
            return "游戏信息";
        case "physical":
            return "配送信息";
        case "overseas":
            return "海外代购信息";
        default:
            return "商品信息";
    }
}

/**
 * Check if a product type is a game type
 */
export function isGameType(productType: ProductType): boolean {
    return ["game_card", "game_cdk", "game_digital"].includes(productType);
}

/**
 * Check if a product type is a digital product (no physical shipping)
 */
export function isDigitalProduct(productType: ProductType): boolean {
    return ["app", "game_card", "game_cdk", "game_digital"].includes(productType);
}

/**
 * Check if a product type requires physical delivery
 */
export function requiresPhysicalDelivery(productType: ProductType): boolean {
    return ["physical", "overseas"].includes(productType);
}
