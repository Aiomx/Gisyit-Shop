/**
 * DownloadsList Component
 *
 * Displays user's purchased products with downloadable files.
 * Groups files by product and order, showing order date, product name, and files.
 *
 * Requirements: 4.1, 4.2, 4.4
 */

import { Link } from "react-router";
import { Download, Package, Calendar, FileArchive } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { DownloadButton } from "~/components/product/download-button";
import type { UserDownloadItem } from "~/lib/download/types";
import { formatFileSize } from "~/lib/download/utils";

// ============================================
// Type Definitions
// ============================================

interface DownloadsListProps {
    downloads: UserDownloadItem[];
}

interface DownloadItemProps {
    item: UserDownloadItem;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

/**
 * Get file type icon based on mime type
 */
function getFileTypeLabel(mimeType: string): string {
    if (mimeType.includes("zip") || mimeType.includes("compressed")) {
        return "压缩包";
    }
    if (mimeType.includes("executable") || mimeType.includes("x-msdownload")) {
        return "可执行文件";
    }
    if (mimeType.includes("dmg") || mimeType.includes("apple-diskimage")) {
        return "磁盘映像";
    }
    if (mimeType.includes("iso")) {
        return "ISO 镜像";
    }
    return "文件";
}

// ============================================
// Components
// ============================================

/**
 * Single file item in the download list
 */
function FileItem({
    file,
    productId
}: {
    file: UserDownloadItem["files"][0];
    productId: string;
}) {
    return (
        <div className="flex items-center justify-between py-3 px-4 bg-bg-tertiary/50 rounded-lg">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileArchive className="h-5 w-5 text-text-muted flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary truncate">
                        {file.original_filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>•</span>
                        <span>{getFileTypeLabel(file.mime_type)}</span>
                    </div>
                </div>
            </div>
            <DownloadButton
                fileId={file.id}
                filename={file.original_filename}
                isPurchased={true}
                productId={productId}
                size="sm"
            />
        </div>
    );
}

/**
 * Single download item (product with files)
 * Requirements: 4.2, 4.4
 */
function DownloadItem({ item }: DownloadItemProps) {
    // Use slug for URL if available, fallback to product_id for backward compatibility
    const productUrl = `/product/${item.product_slug || item.product_id}`;

    return (
        <Card className="overflow-hidden">
            {/* Product header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <Link
                            to={productUrl}
                            className="hover:text-accent transition-colors"
                        >
                            <h3 className="font-semibold text-text-primary truncate">
                                {item.product_name}
                            </h3>
                        </Link>
                        <p className="text-sm text-text-muted mt-1">
                            商品编号：{item.product_code}
                        </p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                        {item.files.length} 个文件
                    </Badge>
                </div>

                {/* Order info */}
                <div className="flex items-center gap-4 mt-3 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4" />
                        <span>订单：{item.order_number}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(item.order_date)}</span>
                    </div>
                </div>
            </div>

            {/* Files list */}
            <div className="p-4 space-y-2">
                {item.files.map((file) => (
                    <FileItem
                        key={file.id}
                        file={file}
                        productId={item.product_id}
                    />
                ))}
            </div>
        </Card>
    );
}

/**
 * Empty state when no downloads exist
 */
function EmptyState() {
    return (
        <div className="text-center py-12">
            <Download className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">
                暂无可下载内容
            </h3>
            <p className="text-text-secondary mb-6">
                购买应用商品后，可在此处下载相关文件
            </p>
            <Link
                to="/apps"
                className="inline-flex items-center gap-2 text-accent hover:underline"
            >
                浏览应用商店 →
            </Link>
        </div>
    );
}

// ============================================
// Main Component
// ============================================

/**
 * DownloadsList Component
 *
 * Displays all downloadable products for the user, grouped by order.
 *
 * Requirements: 4.1, 4.2, 4.4
 */
export function DownloadsList({ downloads }: DownloadsListProps) {
    if (downloads.length === 0) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-6">
            {downloads.map((item) => (
                <DownloadItem
                    key={`${item.order_id}-${item.product_id}`}
                    item={item}
                />
            ))}
        </div>
    );
}

/**
 * Utility function to extract download display fields
 * Used for property testing - Requirements 4.2
 */
export function extractDownloadDisplayFields(item: UserDownloadItem): {
    productName: string;
    productCode: string;
    orderNumber: string;
    orderDate: string;
    fileCount: number;
    files: Array<{
        filename: string;
        fileSize: string;
        fileType: string;
    }>;
} {
    return {
        productName: item.product_name,
        productCode: item.product_code,
        orderNumber: item.order_number,
        orderDate: formatDate(item.order_date),
        fileCount: item.files.length,
        files: item.files.map((file) => ({
            filename: file.original_filename,
            fileSize: formatFileSize(file.file_size),
            fileType: getFileTypeLabel(file.mime_type),
        })),
    };
}
