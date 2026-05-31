/**
 * Property-Based Tests for Webhook Idempotency
 *
 * **Feature: store-integration, Property 14: Webhook idempotency**
 * **Validates: Requirements 10.1, 10.2, 10.3**
 *
 * These tests verify that for any Stripe webhook event, the system
 * processes it at most once, using event.id as the idempotency key.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import type { WebhookEvent, WebhookEventType } from "./types";
import {
    checkEventProcessed,
    recordProcessedEvent,
    processEventIdempotently,
    type IdempotencyCheckResult,
    type RecordEventResult,
} from "./webhook.server";
import { setMCPBridge } from "~/lib/supabase/mcp-client.server";

// ============================================
// Mock MCP Bridge for Testing
// ============================================

/**
 * In-memory store for simulating stripe_events table
 */
let mockStripeEventsStore: Map<string, { event_id: string; event_type: string; payload?: unknown }>;

/**
 * Create a mock MCP bridge for testing
 */
function createMockMCPBridge() {
    return {
        postgrestRequest: async (request: {
            method: string;
            path: string;
            body?: Record<string, unknown>;
        }) => {
            const { method, path, body } = request;

            // Handle SELECT on stripe_events
            if (method === "GET" && path.includes("/stripe_events")) {
                const eventIdMatch = path.match(/event_id=eq\.([^&]+)/);
                if (eventIdMatch) {
                    const eventId = eventIdMatch[1];
                    const event = mockStripeEventsStore.get(eventId);
                    return event ? [event] : [];
                }
                return Array.from(mockStripeEventsStore.values());
            }

            // Handle INSERT on stripe_events
            if (method === "POST" && path.includes("/stripe_events")) {
                const eventData = body as { event_id: string; event_type: string; payload?: unknown };
                if (mockStripeEventsStore.has(eventData.event_id)) {
                    // Simulate duplicate key error - throw with "duplicate" in message
                    // This matches what the recordProcessedEvent function checks for
                    const error = new Error("duplicate key value violates unique constraint");
                    throw error;
                }
                mockStripeEventsStore.set(eventData.event_id, eventData);
                return [{ id: `mock_${Date.now()}`, ...eventData }];
            }

            return [];
        },
    };
}

// ============================================
// Arbitraries (Generators)
// ============================================

/**
 * Generate a hex string of specified length
 */
const hexStringArb = (length: number) =>
    fc.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: length, maxLength: length })
        .map(chars => chars.join(''));

/**
 * Generate a valid Stripe event ID
 */
const stripeEventIdArb = hexStringArb(24).map((hex) => `evt_${hex}`);

/**
 * Generate a valid webhook event type
 */
const webhookEventTypeArb: fc.Arbitrary<WebhookEventType> = fc.constantFrom(
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.succeeded",
    "payment_intent.payment_failed"
);

/**
 * Generate a valid timestamp (Unix seconds)
 */
const timestampArb = fc.integer({
    min: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
    max: Math.floor(Date.now() / 1000),
});

/**
 * Generate a minimal valid webhook event
 */
const webhookEventArb: fc.Arbitrary<WebhookEvent> = fc.record({
    id: stripeEventIdArb,
    type: webhookEventTypeArb,
    data: fc.record({
        object: fc.record({
            id: fc.string({ minLength: 5, maxLength: 30 }),
        }),
    }),
    created: timestampArb,
}) as fc.Arbitrary<WebhookEvent>;

// ============================================
// Property Tests
// ============================================

describe("Property 14: Webhook idempotency", () => {
    beforeEach(() => {
        // Reset the mock store before each test
        mockStripeEventsStore = new Map();
        // Set up the mock MCP bridge
        setMCPBridge(createMockMCPBridge());
    });

    /**
     * **Feature: store-integration, Property 14: Webhook idempotency**
     * **Validates: Requirements 10.1, 10.2, 10.3**
     *
     * For any Stripe webhook event, the system SHALL process it at most once,
     * using event.id as the idempotency key.
     */
    it("processes each event at most once", async () => {
        await fc.assert(
            fc.asyncProperty(webhookEventArb, async (event) => {
                let processCount = 0;
                const handler = async () => {
                    processCount++;
                    return { processed: true };
                };

                // First processing should execute the handler
                const firstResult = await processEventIdempotently(event.id, event.type, handler, event.data.object);
                expect(firstResult.skipped).toBe(false);
                expect(firstResult.result).toEqual({ processed: true });
                expect(processCount).toBe(1);

                // Second processing should skip (idempotent)
                const secondResult = await processEventIdempotently(event.id, event.type, handler, event.data.object);
                expect(secondResult.skipped).toBe(true);
                expect(secondResult.result).toBeNull();
                expect(processCount).toBe(1); // Still 1, not incremented

                // Third processing should also skip
                const thirdResult = await processEventIdempotently(event.id, event.type, handler, event.data.object);
                expect(thirdResult.skipped).toBe(true);
                expect(processCount).toBe(1); // Still 1

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * checkEventProcessed returns false for new events
     * **Validates: Requirements 10.1**
     */
    it("checkEventProcessed returns false for new events", async () => {
        await fc.assert(
            fc.asyncProperty(stripeEventIdArb, async (eventId) => {
                const result = await checkEventProcessed(eventId);

                // New event should not be marked as processed
                expect(result.alreadyProcessed).toBe(false);
                expect(result.error).toBeUndefined();

                return true;
            }),
            { numRuns: 100 }
        );
    });

    /**
     * checkEventProcessed returns true for recorded events
     * **Validates: Requirements 10.1, 10.2**
     */
    it("checkEventProcessed returns true for recorded events", async () => {
        await fc.assert(
            fc.asyncProperty(
                stripeEventIdArb,
                webhookEventTypeArb,
                async (eventId, eventType) => {
                    // First, record the event
                    const recordResult = await recordProcessedEvent(eventId, eventType);
                    expect(recordResult.success).toBe(true);

                    // Now check if it's processed
                    const checkResult = await checkEventProcessed(eventId);
                    expect(checkResult.alreadyProcessed).toBe(true);
                    expect(checkResult.error).toBeUndefined();

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * recordProcessedEvent successfully records new events
     * **Validates: Requirements 10.3**
     */
    it("recordProcessedEvent successfully records new events", async () => {
        await fc.assert(
            fc.asyncProperty(
                stripeEventIdArb,
                webhookEventTypeArb,
                async (eventId, eventType) => {
                    const result = await recordProcessedEvent(eventId, eventType);

                    expect(result.success).toBe(true);
                    expect(result.error).toBeUndefined();

                    // Verify the event is in the store
                    expect(mockStripeEventsStore.has(eventId)).toBe(true);
                    const stored = mockStripeEventsStore.get(eventId);
                    expect(stored?.event_type).toBe(eventType);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * recordProcessedEvent handles duplicate events gracefully
     * **Validates: Requirements 10.3**
     * 
     * Note: This test verifies that when a duplicate event is recorded,
     * the function returns success (idempotent behavior). The actual
     * duplicate detection happens at the database level via unique constraint.
     */
    it("recordProcessedEvent handles duplicate events gracefully", async () => {
        await fc.assert(
            fc.asyncProperty(
                stripeEventIdArb,
                webhookEventTypeArb,
                async (eventId, eventType) => {
                    // Record the event first time
                    const firstResult = await recordProcessedEvent(eventId, eventType);
                    expect(firstResult.success).toBe(true);

                    // Record the same event again
                    // The function should handle duplicates gracefully
                    // Either by returning success (if duplicate is detected)
                    // or by catching the duplicate key error
                    const secondResult = await recordProcessedEvent(eventId, eventType);

                    // The key property: duplicate recording should not fail catastrophically
                    // It should either succeed (idempotent) or return a handled error
                    // In our implementation, we treat duplicates as success
                    expect(secondResult.success).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Different events are processed independently
     */
    it("different events are processed independently", async () => {
        await fc.assert(
            fc.asyncProperty(
                webhookEventArb,
                webhookEventArb,
                async (event1, event2) => {
                    // Ensure events have different IDs
                    fc.pre(event1.id !== event2.id);

                    let process1Count = 0;
                    let process2Count = 0;

                    // Process first event
                    await processEventIdempotently(event1.id, event1.type, async () => {
                        process1Count++;
                        return { event: 1 };
                    }, event1.data.object);

                    // Process second event
                    await processEventIdempotently(event2.id, event2.type, async () => {
                        process2Count++;
                        return { event: 2 };
                    }, event2.data.object);

                    // Both should have been processed once
                    expect(process1Count).toBe(1);
                    expect(process2Count).toBe(1);

                    // Processing first event again should skip
                    await processEventIdempotently(event1.id, event1.type, async () => {
                        process1Count++;
                        return { event: 1 };
                    }, event1.data.object);
                    expect(process1Count).toBe(1); // Still 1

                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Empty event ID is handled gracefully
     */
    it("handles empty event ID gracefully", async () => {
        const result = await checkEventProcessed("");
        expect(result.error).toBeDefined();
    });

    /**
     * recordProcessedEvent requires both eventId and eventType
     */
    it("recordProcessedEvent requires both eventId and eventType", async () => {
        const result1 = await recordProcessedEvent("", "payment_intent.succeeded");
        expect(result1.success).toBe(false);
        expect(result1.error).toBeDefined();

        const result2 = await recordProcessedEvent("evt_123", "");
        expect(result2.success).toBe(false);
        expect(result2.error).toBeDefined();
    });
});
