/**
 * Property-Based Tests for Order Ownership Verification
 * 
 * Tests for Requirements 9.2, 9.3:
 * - 9.2: Store SHALL verify the user owns the order before returning data
 * - 9.3: IF a user attempts to access another user's order THEN the Store SHALL return a 403 Forbidden response
 * 
 * **Feature: store-integration, Property 15: Order ownership verification**
 * **Validates: Requirements 9.2, 9.3**
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { verifyOrderOwnership } from "./order-operations.server";

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a valid user ID (UUID format)
 */
const userIdArb = fc.uuid();

/**
 * Generate a minimal order object with user_id
 */
const orderWithUserArb = (userId: string) => ({
    user_id: userId,
});

// ============================================
// Property Tests
// ============================================

describe("Property 15: Order ownership verification", () => {
    /**
     * **Feature: store-integration, Property 15: Order ownership verification**
     * **Validates: Requirements 9.2, 9.3**
     * 
     * For any order detail request, the Store SHALL verify that the requesting user
     * owns the order being accessed, returning 403 if ownership check fails.
     */

    /**
     * Property: Owner can access their own order
     * 
     * For any user ID, if the order belongs to that user,
     * ownership verification SHALL return true.
     */
    it("owner can access their own order", () => {
        fc.assert(
            fc.property(
                userIdArb,
                (userId) => {
                    const order = orderWithUserArb(userId);
                    const result = verifyOrderOwnership(order, userId);

                    // Owner should be able to access their own order
                    expect(result).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Non-owner cannot access another user's order
     * 
     * For any two different user IDs, if the order belongs to one user,
     * the other user SHALL NOT be able to access it.
     */
    it("non-owner cannot access another user's order", () => {
        fc.assert(
            fc.property(
                userIdArb,
                userIdArb.filter((id) => id !== ""), // Ensure non-empty
                (ownerId, requesterId) => {
                    // Skip if IDs happen to be the same (extremely unlikely with UUIDs)
                    fc.pre(ownerId !== requesterId);

                    const order = orderWithUserArb(ownerId);
                    const result = verifyOrderOwnership(order, requesterId);

                    // Non-owner should NOT be able to access the order
                    expect(result).toBe(false);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Ownership verification is symmetric
     * 
     * For any order and user, the result of ownership verification
     * is deterministic and consistent.
     */
    it("ownership verification is deterministic", () => {
        fc.assert(
            fc.property(
                userIdArb,
                userIdArb,
                (ownerId, requesterId) => {
                    const order = orderWithUserArb(ownerId);

                    // Call verification multiple times
                    const result1 = verifyOrderOwnership(order, requesterId);
                    const result2 = verifyOrderOwnership(order, requesterId);
                    const result3 = verifyOrderOwnership(order, requesterId);

                    // Results should be consistent
                    expect(result1).toBe(result2);
                    expect(result2).toBe(result3);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Ownership is based on exact user ID match
     * 
     * For any order, ownership verification SHALL return true
     * if and only if the requesting user ID exactly matches the order's user_id.
     */
    it("ownership is based on exact user ID match", () => {
        fc.assert(
            fc.property(
                userIdArb,
                userIdArb,
                (ownerId, requesterId) => {
                    const order = orderWithUserArb(ownerId);
                    const result = verifyOrderOwnership(order, requesterId);

                    // Result should be true if and only if IDs match exactly
                    const expectedResult = ownerId === requesterId;
                    expect(result).toBe(expectedResult);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty or whitespace user IDs are handled correctly
     * 
     * Edge case: Ensure that empty strings or whitespace-only strings
     * are handled correctly in ownership verification.
     */
    it("handles edge case user IDs correctly", () => {
        // Empty string owner, non-empty requester
        const order1 = orderWithUserArb("");
        expect(verifyOrderOwnership(order1, "some-user-id")).toBe(false);

        // Non-empty owner, empty string requester
        const order2 = orderWithUserArb("some-user-id");
        expect(verifyOrderOwnership(order2, "")).toBe(false);

        // Both empty (edge case - should match)
        const order3 = orderWithUserArb("");
        expect(verifyOrderOwnership(order3, "")).toBe(true);
    });

    /**
     * Property: Case sensitivity in user ID comparison
     * 
     * User IDs should be compared case-sensitively.
     */
    it("user ID comparison is case-sensitive", () => {
        const order = orderWithUserArb("User-123");

        // Same case should match
        expect(verifyOrderOwnership(order, "User-123")).toBe(true);

        // Different case should NOT match
        expect(verifyOrderOwnership(order, "user-123")).toBe(false);
        expect(verifyOrderOwnership(order, "USER-123")).toBe(false);
    });
});
