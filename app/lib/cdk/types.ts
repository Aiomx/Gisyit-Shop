/**
 * CDK (激活码) Type Definitions
 *
 * Types for the CDK auto-delivery system.
 * These types define the data structures for CDK inventory management,
 * reservation, delivery, and status tracking.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

// ============================================
// CDK Status Types
// ============================================

/**
 * CDK code status values
 *
 * - available: Imported and ready for reservation
 * - reserved: Locked for a pending order
 * - delivered: Successfully delivered after payment
 * - invalid: Manually invalidated by admin
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export const CDKStatus = {
    AVAILABLE: "available",
    RESERVED: "reserved",
    DELIVERED: "delivered",
    INVALID: "invalid",
} as const;

export type CDKStatusType = (typeof CDKStatus)[keyof typeof CDKStatus];

/**
 * Valid status transitions for CDK codes
 *
 * Defines the state machine for CDK status changes:
 * - available → reserved (order created)
 * - reserved → delivered (payment success)
 * - reserved → available (timeout/cancel)
 * - available → invalid (admin action)
 * - reserved → invalid (admin action)
 */
export const CDKStatusTransitions: Record<CDKStatusType, CDKStatusType[]> = {
    [CDKStatus.AVAILABLE]: [CDKStatus.RESERVED, CDKStatus.INVALID],
    [CDKStatus.RESERVED]: [CDKStatus.DELIVERED, CDKStatus.AVAILABLE, CDKStatus.INVALID],
    [CDKStatus.DELIVERED]: [], // Terminal state
    [CDKStatus.INVALID]: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
    from: CDKStatusType,
    to: CDKStatusType
): boolean {
    return CDKStatusTransitions[from].includes(to);
}

// ============================================
// CDK Code Types
// ============================================

/**
 * CDK code entity
 *
 * Represents a single activation code in the inventory.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export interface CDKCode {
    id: string;
    product_id: string;
    code: string;
    code_hash: string;
    status: CDKStatusType;
    order_id?: string;
    reserved_at?: string;
    delivered_at?: string;
    invalidated_at?: string;
    import_batch_id?: string;
    created_at: string;
    updated_at: string;
}

/**
 * CDK code for display (without sensitive content for unpaid orders)
 */
export interface CDKCodeDisplay {
    id: string;
    status: CDKStatusType;
    /** Code content - only visible for delivered codes on paid orders */
    code?: string;
    delivered_at?: string;
}

// ============================================
// Reservation Types
// ============================================

/**
 * Result of a CDK reservation operation
 *
 * Requirements: 4.1, 4.2, 4.3
 */
export interface CDKReservationResult {
    success: boolean;
    /** Reserved CDK code IDs (not content) */
    reservedCodeIds: string[];
    /** Error message if reservation failed */
    error?: string;
    /** Error code for programmatic handling */
    errorCode?: CDKErrorCode;
}

// ============================================
// Delivery Types
// ============================================

/**
 * A delivered CDK code with its content
 */
export interface DeliveredCode {
    id: string;
    code: string;
}

/**
 * Result of a CDK delivery operation
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */
export interface CDKDeliveryResult {
    success: boolean;
    /** Delivered codes with content */
    deliveredCodes: DeliveredCode[];
    /** Error message if delivery failed */
    error?: string;
    /** Error code for programmatic handling */
    errorCode?: CDKErrorCode;
    /** Whether this was an idempotent return of existing delivery */
    wasAlreadyDelivered?: boolean;
}

// ============================================
// Release Types
// ============================================

/**
 * Reason for releasing reserved CDK codes
 */
export type CDKReleaseReason =
    | "payment_timeout"
    | "order_cancelled"
    | "orphan_cleanup"
    | "admin_action";

/**
 * Result of a CDK release operation
 *
 * Requirements: 6.2, 6.3, 6.4
 */
export interface CDKReleaseResult {
    success: boolean;
    /** Number of codes released */
    releasedCount: number;
    /** Error message if release failed */
    error?: string;
}

// ============================================
// Import Types
// ============================================

/**
 * Source type for CDK import
 */
export type CDKImportSourceType = "csv" | "xlsx" | "text";

/**
 * Result of a CDK import operation
 *
 * Requirements: 1.6
 */
export interface CDKImportResult {
    success: boolean;
    /** Number of codes successfully imported */
    successCount: number;
    /** Number of duplicate codes skipped */
    duplicateCount: number;
    /** Number of codes that failed validation */
    invalidCount: number;
    /** Total codes processed */
    totalCount: number;
    /** Detailed errors for invalid codes */
    errors: CDKImportError[];
    /** Import batch ID for tracking */
    batchId?: string;
}

/**
 * Error detail for a failed import line
 */
export interface CDKImportError {
    line: number;
    code: string;
    reason: string;
}

/**
 * CDK import batch record
 */
export interface CDKImportBatch {
    id: string;
    product_id: string;
    admin_id: string;
    source_type: CDKImportSourceType;
    total_count: number;
    success_count: number;
    duplicate_count: number;
    invalid_count: number;
    error_details?: CDKImportError[];
    created_at: string;
}

// ============================================
// Inventory Types
// ============================================

/**
 * CDK inventory statistics
 *
 * Requirements: 3.5, 8.1
 */
export interface CDKInventoryStats {
    total: number;
    available: number;
    reserved: number;
    delivered: number;
    invalid: number;
}

/**
 * CDK code detail for admin view
 */
export interface CDKCodeDetail {
    id: string;
    code: string;
    status: CDKStatusType;
    product_id: string;
    product_name?: string;
    order_id?: string;
    order_number?: string;
    created_at: string;
    updated_at: string;
    reserved_at?: string;
    delivered_at?: string;
    invalidated_at?: string;
}

// ============================================
// Audit Types
// ============================================

/**
 * CDK audit action types
 */
export type CDKAuditAction =
    | "imported"
    | "reserved"
    | "delivered"
    | "released"
    | "invalidated";

/**
 * Actor type for audit logs
 */
export type CDKAuditActorType = "system" | "admin" | "webhook";

/**
 * CDK audit log entry
 *
 * Requirements: 6.4, 9.4
 */
export interface CDKAuditLog {
    id: string;
    cdk_code_id: string;
    action: CDKAuditAction;
    old_status?: CDKStatusType;
    new_status: CDKStatusType;
    order_id?: string;
    actor_id?: string;
    actor_type?: CDKAuditActorType;
    reason?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
}

// ============================================
// Error Types
// ============================================

/**
 * Error codes for CDK operations
 */
export const CDKErrorCodes = {
    // Reservation errors
    INSUFFICIENT_INVENTORY: "INSUFFICIENT_INVENTORY",
    RESERVATION_FAILED: "RESERVATION_FAILED",
    CONCURRENT_CONFLICT: "CONCURRENT_CONFLICT",

    // Delivery errors
    ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
    ORDER_NOT_PAID: "ORDER_NOT_PAID",
    NO_RESERVED_CODES: "NO_RESERVED_CODES",
    DELIVERY_FAILED: "DELIVERY_FAILED",

    // Release errors
    RELEASE_FAILED: "RELEASE_FAILED",

    // Import errors
    INVALID_FILE_FORMAT: "INVALID_FILE_FORMAT",
    PARSE_ERROR: "PARSE_ERROR",
    VALIDATION_FAILED: "VALIDATION_FAILED",

    // General errors
    UNAUTHORIZED: "UNAUTHORIZED",
    DATABASE_ERROR: "DATABASE_ERROR",
    PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
    CODE_NOT_FOUND: "CODE_NOT_FOUND",
} as const;

export type CDKErrorCode = (typeof CDKErrorCodes)[keyof typeof CDKErrorCodes];

/**
 * User-friendly error messages for CDK operations
 */
export const CDKErrorMessages: Record<CDKErrorCode, string> = {
    INSUFFICIENT_INVENTORY: "库存不足，无法完成预留",
    RESERVATION_FAILED: "预留失败，请稍后重试",
    CONCURRENT_CONFLICT: "并发冲突，请稍后重试",
    ORDER_NOT_FOUND: "订单不存在",
    ORDER_NOT_PAID: "订单未支付，无法发货",
    NO_RESERVED_CODES: "没有预留的激活码",
    DELIVERY_FAILED: "发货失败，请稍后重试",
    RELEASE_FAILED: "释放失败，请稍后重试",
    INVALID_FILE_FORMAT: "文件格式不支持",
    PARSE_ERROR: "文件解析失败",
    VALIDATION_FAILED: "激活码格式验证失败",
    UNAUTHORIZED: "无权限执行此操作",
    DATABASE_ERROR: "数据库操作失败，请稍后重试",
    PRODUCT_NOT_FOUND: "商品不存在",
    CODE_NOT_FOUND: "激活码不存在",
};

// ============================================
// Utility Types
// ============================================

/**
 * Result of deduplication operation
 */
export interface DeduplicationResult {
    uniqueCodes: string[];
    duplicateCount: number;
}

/**
 * Parsed text input result
 */
export interface ParsedTextResult {
    codes: string[];
    lineCount: number;
}

/**
 * Result of CDK code validation
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export interface CDKValidationResult {
    /** Whether the code is valid */
    valid: boolean;
    /** The normalized (trimmed) code if valid */
    normalizedCode?: string;
    /** Error message if validation failed */
    error?: string;
}
