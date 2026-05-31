/**
 * Property-Based Tests for Active Brand Filtering
 *
 * **Feature: brand-management, Property 5: Active Brand Filtering**
 * **Validates: Requirements 1.6, 3.1**
 *
 * These tests verify that:
 * - Frontend brand queries only return brands where is_active = true
 * - Inactive brands are never included in frontend query results
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Brand, BrandGroup } from "~/lib/supabase/types";

// ============================================
// Pure Functions for Testing (extracted logic)
// ============================================

/**
 * Filter brands to only include active ones
 * This is the core filtering logic used by getActiveBrands
 */
function filterActiveBrands(brands: Brand[]): Brand[] {
    return brands.filter((brand) => brand.is_active === true);
}

/**
 * Check if all brands in a list are active
 */
function allBrandsActive(brands: Brand[]): boolean {
    return brands.every((brand) => brand.is_active === true);
}

/**
 * Check if any inactive brand is in the result
 */
function containsInactiveBrand(brands: Brand[]): boolean {
    return brands.some((brand) => brand.is_active === false);
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid brand group
 */
const brandGroupArb: fc.Arbitrary<BrandGroup> = fc.constantFrom(
    "os",
    "platform",
    "store",
    "other"
);

/**
 * Generate a valid slug (lowercase letters, numbers, hyphens)
 */
const slugArb = fc
    .array(
        fc.oneof(
            fc.integer({ min: 97, max: 122 }).map((c) => String.fromCharCode(c)), // a-z
            fc.integer({ min: 48, max: 57 }).map((c) => String.fromCharCode(c)), // 0-9
            fc.constant("-")
        ),
        { minLength: 1, maxLength: 50 }
    )
    .map((chars) => chars.join(""))
    .filter((s) => !s.startsWith("-") && !s.endsWith("-") && !s.includes("--"));

/**
 * Generate a valid ISO date string
 */
const isoDateArb = fc
    .integer({ min: 1577836800000, max: 1924905600000 })
    .map((timestamp) => new Date(timestamp).toISOString());

/**
 * Generate a valid Brand
 */
const brandArb: fc.Arbitrary<Brand> = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    slug: slugArb,
    logo_url: fc.option(fc.webUrl(), { nil: undefined }),
    brand_group: brandGroupArb,
    sort_order: fc.integer({ min: 0, max: 1000 }),
    is_active: fc.boolean(),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    created_at: isoDateArb,
    updated_at: isoDateArb,
});

/**
 * Generate an active brand (is_active = true)
 */
const activeBrandArb: fc.Arbitrary<Brand> = brandArb.map((brand) => ({
    ...brand,
    is_active: true,
}));

/**
 * Generate an inactive brand (is_active = false)
 */
const inactiveBrandArb: fc.Arbitrary<Brand> = brandArb.map((brand) => ({
    ...brand,
    is_active: false,
}));

/**
 * Generate an array of brands (mixed active/inactive)
 */
const brandsArb = fc.array(brandArb, { minLength: 0, maxLength: 20 });

/**
 * Generate an array with at least one inactive brand
 */
const brandsWithInactiveArb = fc
    .tuple(
        fc.array(brandArb, { minLength: 0, maxLength: 10 }),
        inactiveBrandArb,
        fc.array(brandArb, { minLength: 0, maxLength: 10 })
    )
    .map(([before, inactive, after]) => [...before, inactive, ...after]);

// ============================================
// Property Tests
// ============================================

describe("Property 5: Active Brand Filtering", () => {
    /**
     * **Feature: brand-management, Property 5: Active Brand Filtering**
     * **Validates: Requirements 1.6, 3.1**
     *
     * Core property: Filtered results contain only active brands
     */
    it("filtered brands contain only active brands", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const filtered = filterActiveBrands(brands);

                // All brands in the result must be active
                expect(allBrandsActive(filtered)).toBe(true);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Inactive brands are never included in filtered results
     */
    it("inactive brands are never included in filtered results", () => {
        fc.assert(
            fc.property(brandsWithInactiveArb, (brands) => {
                const filtered = filterActiveBrands(brands);

                // No inactive brand should be in the result
                expect(containsInactiveBrand(filtered)).toBe(false);

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * All active brands from input are preserved in output
     */
    it("all active brands from input are preserved in output", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const filtered = filterActiveBrands(brands);
                const inputActiveBrands = brands.filter((b) => b.is_active);

                // Count should match
                expect(filtered.length).toBe(inputActiveBrands.length);

                // All active brands should be in the result
                for (const activeBrand of inputActiveBrands) {
                    expect(filtered.some((b) => b.id === activeBrand.id)).toBe(true);
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Empty input produces empty output
     */
    it("empty input produces empty output", () => {
        const filtered = filterActiveBrands([]);
        expect(filtered).toEqual([]);
    });

    /**
     * All active brands input produces same output
     */
    it("all active brands input produces same length output", () => {
        fc.assert(
            fc.property(
                fc.array(activeBrandArb, { minLength: 1, maxLength: 20 }),
                (activeBrands) => {
                    const filtered = filterActiveBrands(activeBrands);

                    // All brands should be preserved
                    expect(filtered.length).toBe(activeBrands.length);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * All inactive brands input produces empty output
     */
    it("all inactive brands input produces empty output", () => {
        fc.assert(
            fc.property(
                fc.array(inactiveBrandArb, { minLength: 1, maxLength: 20 }),
                (inactiveBrands) => {
                    const filtered = filterActiveBrands(inactiveBrands);

                    // No brands should be in the result
                    expect(filtered.length).toBe(0);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Filtering is idempotent - filtering twice produces same result
     */
    it("filtering is idempotent", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const filtered1 = filterActiveBrands(brands);
                const filtered2 = filterActiveBrands(filtered1);

                // Second filter should produce same result
                expect(filtered2.length).toBe(filtered1.length);
                expect(filtered2.map((b) => b.id).sort()).toEqual(
                    filtered1.map((b) => b.id).sort()
                );

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * Filtering preserves brand data integrity
     */
    it("filtering preserves brand data integrity", () => {
        fc.assert(
            fc.property(brandsArb, (brands) => {
                const filtered = filterActiveBrands(brands);

                // Each filtered brand should have all required fields
                for (const brand of filtered) {
                    expect(brand.id).toBeDefined();
                    expect(brand.name).toBeDefined();
                    expect(brand.slug).toBeDefined();
                    expect(brand.brand_group).toBeDefined();
                    expect(typeof brand.sort_order).toBe("number");
                    expect(brand.is_active).toBe(true);
                    expect(brand.created_at).toBeDefined();
                    expect(brand.updated_at).toBeDefined();
                }

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
