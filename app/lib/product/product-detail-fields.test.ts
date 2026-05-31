/**
 * Property-Based Tests for Product Detail Type-Specific Fields
 * 
 * **Feature: store-frontend, Property 2: Product detail displays type-specific fields**
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
 * 
 * These tests verify that product detail pages display the correct
 * type-specific fields based on the product type.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Product, ProductType, DeliveryType } from "~/lib/supabase/types";
import {
    getTypeSpecificFields,
    validateTypeSpecificFieldsDisplayed,
    getInfoSectionTitle,
    isGameType,
    isDigitalProduct,
    requiresPhysicalDelivery,
    type TypeSpecificFields,
} from "./product-detail-fields";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid ProductType
 */
const productTypeArb = fc.constantFrom<ProductType>(
    "app",
    "game_card",
    "game_cdk",
    "game_digital",
    "physical",
    "overseas"
);

/**
 * Generate app product type only
 */
const appProductTypeArb = fc.constant<ProductType>("app");

/**
 * Generate game product types only
 */
const gameProductTypeArb = fc.constantFrom<ProductType>(
    "game_card",
    "game_cdk",
    "game_digital"
);

/**
 * Generate physical product type only
 */
const physicalProductTypeArb = fc.constant<ProductType>("physical");

/**
 * Generate overseas product type only
 */
const overseasProductTypeArb = fc.constant<ProductType>("overseas");

/**
 * Generate a valid DeliveryType
 */
const deliveryTypeArb = fc.constantFrom<DeliveryType>(
    "download",
    "license_key",
    "cdk",
    "shipment",
    "manual"
);

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc.integer({ min: 1577836800000, max: 1924905600000 })
    .map(timestamp => new Date(timestamp).toISOString());

/**
 * Generate a minimal Product with required fields
 */
const productArb = fc.record({
    id: fc.uuid(),
    product_code: fc.string({ minLength: 8, maxLength: 8 })
        .filter(s => /^[0-9]+$/.test(s) || true)
        .map(s => `Gis${s.replace(/[^0-9]/g, '0').slice(0, 8).padStart(8, '0')}`),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    product_type: productTypeArb,
    delivery_type: deliveryTypeArb,
    category_id: fc.uuid(),
    is_active: fc.boolean(),
    has_discount: fc.boolean(),
    has_demo_video: fc.boolean(),
    created_at: isoDateArb,
    updated_at: isoDateArb,
}) as fc.Arbitrary<Product>;

/**
 * Generate a Product with a specific product type
 */
function productWithTypeArb(typeArb: fc.Arbitrary<ProductType>): fc.Arbitrary<Product> {
    return fc.record({
        id: fc.uuid(),
        product_code: fc.string({ minLength: 8, maxLength: 8 })
            .map(s => `Gis${s.replace(/[^0-9]/g, '0').slice(0, 8).padStart(8, '0')}`),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        product_type: typeArb,
        delivery_type: deliveryTypeArb,
        category_id: fc.uuid(),
        is_active: fc.boolean(),
        has_discount: fc.boolean(),
        has_demo_video: fc.boolean(),
        created_at: isoDateArb,
        updated_at: isoDateArb,
    }) as fc.Arbitrary<Product>;
}

// ============================================
// Property Tests
// ============================================

describe("Property 2: Product detail displays type-specific fields", () => {
    /**
     * **Feature: store-frontend, Property 2: Product detail displays type-specific fields**
     * **Validates: Requirements 2.2, 2.3, 2.4, 2.5**
     * 
     * For any product, the detail page SHALL display all required fields
     * for that product type.
     */
    it("getTypeSpecificFields returns valid field configuration for any product type", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Fields object should have all required properties
                    return (
                        typeof fields.showPlatformCompatibility === "boolean" &&
                        typeof fields.showDeliveryInstructions === "boolean" &&
                        typeof fields.showRegionRestrictions === "boolean" &&
                        typeof fields.showActivationInstructions === "boolean" &&
                        typeof fields.showShippingInfo === "boolean" &&
                        typeof fields.showEstimatedDelivery === "boolean" &&
                        typeof fields.showTaxStatus === "boolean" &&
                        typeof fields.showReturnPolicy === "boolean"
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 2.2: App products display platform compatibility and download/license instructions
     */
    it("app products show platform compatibility and delivery instructions", () => {
        fc.assert(
            fc.property(
                appProductTypeArb,
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // App products MUST show platform compatibility and delivery instructions
                    return (
                        fields.showPlatformCompatibility === true &&
                        fields.showDeliveryInstructions === true
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 2.3: Game products display region restrictions and activation instructions
     */
    it("game products show region restrictions and activation instructions", () => {
        fc.assert(
            fc.property(
                gameProductTypeArb,
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Game products MUST show region restrictions and activation instructions
                    return (
                        fields.showRegionRestrictions === true &&
                        fields.showActivationInstructions === true &&
                        fields.showDeliveryInstructions === true
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 2.4: Physical products display shipping info and estimated delivery
     */
    it("physical products show shipping info and estimated delivery time", () => {
        fc.assert(
            fc.property(
                physicalProductTypeArb,
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Physical products MUST show shipping info and estimated delivery
                    return (
                        fields.showShippingInfo === true &&
                        fields.showEstimatedDelivery === true &&
                        fields.showReturnPolicy === true
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Requirement 2.5: Overseas products display delivery timeline, tax status, and return policy
     */
    it("overseas products show delivery timeline, tax status, and return policy", () => {
        fc.assert(
            fc.property(
                overseasProductTypeArb,
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Overseas products MUST show delivery timeline, tax status, and return policy
                    return (
                        fields.showEstimatedDelivery === true &&
                        fields.showTaxStatus === true &&
                        fields.showReturnPolicy === true
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Digital products should NOT show shipping info
     */
    it("digital products do not show shipping info", () => {
        fc.assert(
            fc.property(
                fc.constantFrom<ProductType>("app", "game_card", "game_cdk", "game_digital"),
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Digital products should NOT show shipping info
                    return fields.showShippingInfo === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Physical delivery products should show estimated delivery
     */
    it("physical delivery products show estimated delivery time", () => {
        fc.assert(
            fc.property(
                fc.constantFrom<ProductType>("physical", "overseas"),
                (productType) => {
                    const fields = getTypeSpecificFields(productType);

                    // Physical delivery products MUST show estimated delivery
                    return fields.showEstimatedDelivery === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * validateTypeSpecificFieldsDisplayed returns true when required fields are displayed
     */
    it("validation passes when all required fields are displayed", () => {
        fc.assert(
            fc.property(
                productArb,
                (product) => {
                    const requiredFields = getTypeSpecificFields(product.product_type);

                    // If we display exactly the required fields, validation should pass
                    return validateTypeSpecificFieldsDisplayed(product, requiredFields);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * validateTypeSpecificFieldsDisplayed returns true when extra fields are displayed
     */
    it("validation passes when extra fields are displayed beyond required", () => {
        fc.assert(
            fc.property(
                productArb,
                (product) => {
                    // Display ALL fields (superset of required)
                    const allFieldsDisplayed: TypeSpecificFields = {
                        showPlatformCompatibility: true,
                        showDeliveryInstructions: true,
                        showRegionRestrictions: true,
                        showActivationInstructions: true,
                        showShippingInfo: true,
                        showEstimatedDelivery: true,
                        showTaxStatus: true,
                        showReturnPolicy: true,
                    };

                    // Validation should pass because all required fields are included
                    return validateTypeSpecificFieldsDisplayed(product, allFieldsDisplayed);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * getInfoSectionTitle returns non-empty string for any product type
     */
    it("info section title is non-empty for any product type", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const title = getInfoSectionTitle(productType);
                    return typeof title === "string" && title.length > 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * isGameType correctly identifies game product types
     */
    it("isGameType correctly identifies game types", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const isGame = isGameType(productType);
                    const expectedGameTypes = ["game_card", "game_cdk", "game_digital"];

                    return isGame === expectedGameTypes.includes(productType);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * isDigitalProduct correctly identifies digital product types
     */
    it("isDigitalProduct correctly identifies digital products", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const isDigital = isDigitalProduct(productType);
                    const expectedDigitalTypes = ["app", "game_card", "game_cdk", "game_digital"];

                    return isDigital === expectedDigitalTypes.includes(productType);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * requiresPhysicalDelivery correctly identifies physical delivery types
     */
    it("requiresPhysicalDelivery correctly identifies physical delivery products", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const requiresPhysical = requiresPhysicalDelivery(productType);
                    const expectedPhysicalTypes = ["physical", "overseas"];

                    return requiresPhysical === expectedPhysicalTypes.includes(productType);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Digital and physical delivery are mutually exclusive
     */
    it("digital and physical delivery are mutually exclusive", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const isDigital = isDigitalProduct(productType);
                    const requiresPhysical = requiresPhysicalDelivery(productType);

                    // A product cannot be both digital and require physical delivery
                    return !(isDigital && requiresPhysical);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Every product type is either digital or requires physical delivery
     */
    it("every product type is either digital or requires physical delivery", () => {
        fc.assert(
            fc.property(
                productTypeArb,
                (productType) => {
                    const isDigital = isDigitalProduct(productType);
                    const requiresPhysical = requiresPhysicalDelivery(productType);

                    // Every product must be one or the other
                    return isDigital || requiresPhysical;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * App products have correct info section title
     */
    it("app products have '应用信息' as info section title", () => {
        fc.assert(
            fc.property(
                appProductTypeArb,
                (productType) => {
                    return getInfoSectionTitle(productType) === "应用信息";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Game products have correct info section title
     */
    it("game products have '游戏信息' as info section title", () => {
        fc.assert(
            fc.property(
                gameProductTypeArb,
                (productType) => {
                    return getInfoSectionTitle(productType) === "游戏信息";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Physical products have correct info section title
     */
    it("physical products have '配送信息' as info section title", () => {
        fc.assert(
            fc.property(
                physicalProductTypeArb,
                (productType) => {
                    return getInfoSectionTitle(productType) === "配送信息";
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Overseas products have correct info section title
     */
    it("overseas products have '海外代购信息' as info section title", () => {
        fc.assert(
            fc.property(
                overseasProductTypeArb,
                (productType) => {
                    return getInfoSectionTitle(productType) === "海外代购信息";
                }
            ),
            { numRuns: 100 }
        );
    });
});
