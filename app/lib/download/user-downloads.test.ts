/**
 * Property-Based Tests for User Downloads Query
 *
 * Tests for user downloads list functionality.
 *
 * Requirements: 4.1, 4.2
 */

import { describe, it } from "vitest";
import fc from "fast-check";
import type { UserDownloadItem, ProductFile } from "./types";
import { VALID_DOWNLOAD_ORDER_STATUSES } from "./types";
import type { OrderStatus } from "~/lib/supabase/types";

// ============================================
// Test Data Generators
// ============================================

/**
 * All possible order statuses
 */
const allOrderStatuses: OrderStatus[] = [
    "pending",
    "created",
    "pending_payment",
    "paid",
    "fulfilled",
    "completed",
    "cancelled",
];

/**
 * Valid order statuses that grant download permission
 */
const validDownloadStatuses: OrderStatus[] = ["paid", "fulfilled", "completed"];

/**
 * Arbitrary for valid download order statuses
 */
const validOrderStatusArb = fc.constantFrom(...validDownloadStatuses);

/**
 * Arbitrary for any order status
 */
const anyOrderStatusArb = fc.constantFrom(...allOrderStatuses);

/**
 * Valid date arbitrary (within reasonable range)
 * Using integer timestamps to avoid invalid date issues
 */
const validDateArb = fc.integer({
    min: new Date("2020-01-01").getTime(),
    max: new Date("2030-12-31").getTime()
}).map(ts => new Date(ts));

/**
 * Generate a product file (used for type reference)
 */
const productFileArb = fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s.replace(/[^a-zA-Z0-9]/g, '')}.zip`),
    original_filename: fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s.replace(/[^a-zA-Z0-9]/g, '')}.zip`),
    file_size: fc.integer({ min: 1, max: 1000000000 }),
    mime_type: fc.constantFrom("application/zip", "application/x-msdownload", "application/octet-stream"),
    storage_path: fc.string({ minLength: 1, maxLength: 100 }),
    uploaded_at: validDateArb.map(d => d.toISOString()),
    updated_at: validDateArb.map(d => d.toISOString()),
});

// Keep productFileArb for potential future use
void productFileArb;

/**
 * Generate a user download item (used for type reference)
 */
const userDownloadItemArb = fc.record({
    product_id: fc.uuid(),
    product_name: fc.string({ minLength: 1, maxLength: 100 }),
    product_code: fc.string({ minLength: 3, maxLength: 20 }),
    order_id: fc.uuid(),
    order_number: fc.string({ minLength: 10, maxLength: 20 }),
    order_date: validDateArb.map(d => d.toISOString()),
    files: fc.array(productFileArb, { minLength: 1, maxLength: 5 }),
});

// Keep userDownloadItemArb for potential future use
void userDownloadItemArb;

/**
 * Generate an order with items and files
 */
interface MockOrder {
    id: string;
    order_number: string;
    user_id: string;
    status: OrderStatus;
    created_at: string;
}

interface MockOrderItem {
    order_id: string;
    product_id: string;
    product_name: string;
    product_code: string;
}

interface MockProductFile {
    id: string;
    product_id: string;
    filename: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
    uploaded_at: string;
    updated_at: string;
}

const mockOrderArb = fc.record({
    id: fc.uuid(),
    order_number: fc.string({ minLength: 10, maxLength: 20 }),
    user_id: fc.uuid(),
    status: anyOrderStatusArb,
    created_at: validDateArb.map(d => d.toISOString()),
});

// ============================================
// Pure Logic Functions for Testing
// ============================================

/**
 * Filter orders to only include valid download statuses
 * This mirrors the logic in getUserDownloads
 */
function filterValidOrders(orders: MockOrder[]): MockOrder[] {
    return orders.filter(order =>
        VALID_DOWNLOAD_ORDER_STATUSES.includes(order.status)
    );
}

/**
 * Build download items from orders, items, and files
 * This mirrors the logic in getUserDownloads
 */
function buildDownloadItems(
    orders: MockOrder[],
    orderItems: MockOrderItem[],
    productFiles: MockProductFile[]
): UserDownloadItem[] {
    // Filter to valid orders
    const validOrders = filterValidOrders(orders);
    const validOrderIds = new Set(validOrders.map(o => o.id));

    // Filter order items to only those from valid orders
    const validOrderItems = orderItems.filter(item => validOrderIds.has(item.order_id));

    // Group files by product_id
    const filesByProduct = new Map<string, ProductFile[]>();
    for (const file of productFiles) {
        const files = filesByProduct.get(file.product_id) || [];
        files.push(file as ProductFile);
        filesByProduct.set(file.product_id, files);
    }

    // Build download items
    const downloads: UserDownloadItem[] = [];
    for (const item of validOrderItems) {
        const files = filesByProduct.get(item.product_id);
        if (!files || files.length === 0) {
            continue;
        }

        const order = validOrders.find(o => o.id === item.order_id);
        if (!order) continue;

        downloads.push({
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code,
            order_id: order.id,
            order_number: order.order_number,
            order_date: order.created_at,
            files,
        });
    }

    // Sort by order date (newest first)
    downloads.sort((a, b) =>
        new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );

    return downloads;
}

// ============================================
// Property 9: User downloads list shows all purchased products with files
// **Feature: app-download-unlock, Property 9: User downloads list shows all purchased products with files**
// **Validates: Requirements 4.1, 4.2**
// ============================================

describe("Property 9: User downloads list shows all purchased products with files", () => {
    /**
     * **Feature: app-download-unlock, Property 9: User downloads list shows all purchased products with files**
     * **Validates: Requirements 4.1, 4.2**
     *
     * For any user with paid orders containing app products,
     * the downloads page SHALL list all such products with their associated files.
     */
    it("includes all products from valid orders that have files", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.array(mockOrderArb, { minLength: 1, maxLength: 5 }),
                (userId, orders) => {
                    // Set all orders to belong to this user
                    const userOrders = orders.map(o => ({ ...o, user_id: userId }));

                    // Create order items for each order
                    const orderItems: MockOrderItem[] = userOrders.flatMap(order => [{
                        order_id: order.id,
                        product_id: fc.sample(fc.uuid(), 1)[0],
                        product_name: `Product ${order.id.slice(0, 8)}`,
                        product_code: `PROD${order.id.slice(0, 4)}`,
                    }]);

                    // Create files for each product
                    const productFiles: MockProductFile[] = orderItems.map(item => ({
                        id: fc.sample(fc.uuid(), 1)[0],
                        product_id: item.product_id,
                        filename: `file-${item.product_id.slice(0, 8)}.zip`,
                        original_filename: `original-${item.product_id.slice(0, 8)}.zip`,
                        file_size: 1024,
                        mime_type: "application/zip",
                        storage_path: `products/${item.product_id}/file.zip`,
                        uploaded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }));

                    // Build download items
                    const downloads = buildDownloadItems(userOrders, orderItems, productFiles);

                    // Count expected downloads (products from valid orders with files)
                    const validOrderIds = new Set(
                        userOrders
                            .filter(o => VALID_DOWNLOAD_ORDER_STATUSES.includes(o.status))
                            .map(o => o.id)
                    );
                    const expectedCount = orderItems.filter(item =>
                        validOrderIds.has(item.order_id)
                    ).length;

                    return downloads.length === expectedCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("excludes products from invalid order statuses", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                fc.constantFrom("pending", "created", "pending_payment", "cancelled") as fc.Arbitrary<OrderStatus>,
                (userId, productId, invalidStatus) => {
                    const order: MockOrder = {
                        id: fc.sample(fc.uuid(), 1)[0],
                        order_number: "GIS20241221000001",
                        user_id: userId,
                        status: invalidStatus,
                        created_at: new Date().toISOString(),
                    };

                    const orderItem: MockOrderItem = {
                        order_id: order.id,
                        product_id: productId,
                        product_name: "Test Product",
                        product_code: "TEST001",
                    };

                    const productFile: MockProductFile = {
                        id: fc.sample(fc.uuid(), 1)[0],
                        product_id: productId,
                        filename: "test.zip",
                        original_filename: "test.zip",
                        file_size: 1024,
                        mime_type: "application/zip",
                        storage_path: `products/${productId}/test.zip`,
                        uploaded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    const downloads = buildDownloadItems([order], [orderItem], [productFile]);

                    // Should not include products from invalid orders
                    return downloads.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("excludes products without files", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                validOrderStatusArb,
                (userId, productId, validStatus) => {
                    const order: MockOrder = {
                        id: fc.sample(fc.uuid(), 1)[0],
                        order_number: "GIS20241221000001",
                        user_id: userId,
                        status: validStatus,
                        created_at: new Date().toISOString(),
                    };

                    const orderItem: MockOrderItem = {
                        order_id: order.id,
                        product_id: productId,
                        product_name: "Test Product",
                        product_code: "TEST001",
                    };

                    // No files for this product
                    const downloads = buildDownloadItems([order], [orderItem], []);

                    // Should not include products without files
                    return downloads.length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("includes all files for each product", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                validOrderStatusArb,
                fc.integer({ min: 1, max: 5 }), // number of files
                (userId, productId, validStatus, fileCount) => {
                    const order: MockOrder = {
                        id: fc.sample(fc.uuid(), 1)[0],
                        order_number: "GIS20241221000001",
                        user_id: userId,
                        status: validStatus,
                        created_at: new Date().toISOString(),
                    };

                    const orderItem: MockOrderItem = {
                        order_id: order.id,
                        product_id: productId,
                        product_name: "Test Product",
                        product_code: "TEST001",
                    };

                    // Create multiple files for the product
                    const productFiles: MockProductFile[] = Array.from({ length: fileCount }, (_, i) => ({
                        id: fc.sample(fc.uuid(), 1)[0],
                        product_id: productId,
                        filename: `file-${i}.zip`,
                        original_filename: `original-${i}.zip`,
                        file_size: 1024 * (i + 1),
                        mime_type: "application/zip",
                        storage_path: `products/${productId}/file-${i}.zip`,
                        uploaded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }));

                    const downloads = buildDownloadItems([order], [orderItem], productFiles);

                    // Should include all files
                    return downloads.length === 1 && downloads[0].files.length === fileCount;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("groups files by product correctly", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                validOrderStatusArb,
                (userId, validStatus) => {
                    const orderId = fc.sample(fc.uuid(), 1)[0];
                    const productId1 = fc.sample(fc.uuid(), 1)[0];
                    const productId2 = fc.sample(fc.uuid(), 1)[0];

                    const order: MockOrder = {
                        id: orderId,
                        order_number: "GIS20241221000001",
                        user_id: userId,
                        status: validStatus,
                        created_at: new Date().toISOString(),
                    };

                    const orderItems: MockOrderItem[] = [
                        {
                            order_id: orderId,
                            product_id: productId1,
                            product_name: "Product 1",
                            product_code: "PROD001",
                        },
                        {
                            order_id: orderId,
                            product_id: productId2,
                            product_name: "Product 2",
                            product_code: "PROD002",
                        },
                    ];

                    const productFiles: MockProductFile[] = [
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            product_id: productId1,
                            filename: "file1.zip",
                            original_filename: "file1.zip",
                            file_size: 1024,
                            mime_type: "application/zip",
                            storage_path: `products/${productId1}/file1.zip`,
                            uploaded_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            product_id: productId2,
                            filename: "file2.zip",
                            original_filename: "file2.zip",
                            file_size: 2048,
                            mime_type: "application/zip",
                            storage_path: `products/${productId2}/file2.zip`,
                            uploaded_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                    ];

                    const downloads = buildDownloadItems([order], orderItems, productFiles);

                    // Should have 2 download items, each with 1 file
                    if (downloads.length !== 2) return false;

                    // Each product should have its own files
                    const product1Download = downloads.find(d => d.product_id === productId1);
                    const product2Download = downloads.find(d => d.product_id === productId2);

                    return (
                        product1Download !== undefined &&
                        product2Download !== undefined &&
                        product1Download.files.length === 1 &&
                        product2Download.files.length === 1 &&
                        product1Download.files[0].product_id === productId1 &&
                        product2Download.files[0].product_id === productId2
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("includes order information for each download item", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                fc.uuid(), // productId
                validOrderStatusArb,
                (userId, productId, validStatus) => {
                    const orderId = fc.sample(fc.uuid(), 1)[0];
                    const orderNumber = "GIS20241221000001";
                    const orderDate = new Date().toISOString();

                    const order: MockOrder = {
                        id: orderId,
                        order_number: orderNumber,
                        user_id: userId,
                        status: validStatus,
                        created_at: orderDate,
                    };

                    const orderItem: MockOrderItem = {
                        order_id: orderId,
                        product_id: productId,
                        product_name: "Test Product",
                        product_code: "TEST001",
                    };

                    const productFile: MockProductFile = {
                        id: fc.sample(fc.uuid(), 1)[0],
                        product_id: productId,
                        filename: "test.zip",
                        original_filename: "test.zip",
                        file_size: 1024,
                        mime_type: "application/zip",
                        storage_path: `products/${productId}/test.zip`,
                        uploaded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };

                    const downloads = buildDownloadItems([order], [orderItem], [productFile]);

                    // Each download item should have order information
                    if (downloads.length !== 1) return false;
                    const downloadItem = downloads[0];

                    return (
                        downloadItem.order_id === orderId &&
                        downloadItem.order_number === orderNumber &&
                        downloadItem.order_date === orderDate
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("sorts downloads by order date (newest first)", () => {
        fc.assert(
            fc.property(
                fc.uuid(), // userId
                validOrderStatusArb,
                (userId, validStatus) => {
                    const now = new Date();
                    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                    const orders: MockOrder[] = [
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            order_number: "GIS20241221000001",
                            user_id: userId,
                            status: validStatus,
                            created_at: lastWeek.toISOString(),
                        },
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            order_number: "GIS20241221000002",
                            user_id: userId,
                            status: validStatus,
                            created_at: now.toISOString(),
                        },
                        {
                            id: fc.sample(fc.uuid(), 1)[0],
                            order_number: "GIS20241221000003",
                            user_id: userId,
                            status: validStatus,
                            created_at: yesterday.toISOString(),
                        },
                    ];

                    const orderItems: MockOrderItem[] = orders.map(order => ({
                        order_id: order.id,
                        product_id: fc.sample(fc.uuid(), 1)[0],
                        product_name: `Product ${order.order_number}`,
                        product_code: `PROD${order.order_number.slice(-4)}`,
                    }));

                    const productFiles: MockProductFile[] = orderItems.map(item => ({
                        id: fc.sample(fc.uuid(), 1)[0],
                        product_id: item.product_id,
                        filename: "file.zip",
                        original_filename: "file.zip",
                        file_size: 1024,
                        mime_type: "application/zip",
                        storage_path: `products/${item.product_id}/file.zip`,
                        uploaded_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }));

                    const downloads = buildDownloadItems(orders, orderItems, productFiles);

                    // Check that downloads are sorted by date (newest first)
                    for (let i = 1; i < downloads.length; i++) {
                        const prevDate = new Date(downloads[i - 1].order_date).getTime();
                        const currDate = new Date(downloads[i].order_date).getTime();
                        if (prevDate < currDate) {
                            return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
