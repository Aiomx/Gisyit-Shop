/**
 * ProductFiles Component for Store
 *
 * Displays file information for app products without exposing download URLs.
 * Shows "购买后解锁下载" indicator for unpurchased products.
 * Includes download buttons for purchased products.
 *
 * Requirements: 2.1, 2.2, 2.4, 3.1
 */

import { cn } from "~/lib/utils";
import { formatFileSize } from "~/lib/download/utils";
import type { ProductFile } from "~/lib/supabase/types";
import { Badge } from "~/components/ui/badge";
import { FileIcon, Download, Lock, HardDrive } from "lucide-react";
import { DownloadButton } from "./download-button";

// ============================================
// Type Definitions
// ============================================

/**
 * Type for safe file metadata (without storage_path)
 *
 * This type ensures that storage_path is never exposed to the frontend.
 * Requirements: 2.4 - Do NOT expose download URLs
 */
export type SafeProductFile = Omit<ProductFile, "storage_path">;

/**
 * Props for ProductFiles component
 */
export interface ProductFilesProps {
    /** List of product files to display (safe metadata without storage_path) */
    files: SafeProductFile[];
    /** Whether the user has purchased this product */
    isPurchased?: boolean;
    /** Product ID for purchase links */
    productId?: string;
    /** Whether this is a free product (uses different download flow) */
    isFreeProduct?: boolean;
    /** Additional CSS classes */
    className?: string;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get file type display name from MIME type
 */
function getFileTypeDisplay(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        "application/zip": "ZIP",
        "application/x-zip-compressed": "ZIP",
        "application/x-rar-compressed": "RAR",
        "application/x-7z-compressed": "7Z",
        "application/x-tar": "TAR",
        "application/gzip": "GZ",
        "application/x-msdownload": "EXE",
        "application/x-msdos-program": "EXE",
        "application/x-apple-diskimage": "DMG",
        "application/octet-stream": "文件",
        "application/pdf": "PDF",
        "text/plain": "TXT",
        "image/png": "PNG",
        "image/jpeg": "JPG",
    };

    return mimeMap[mimeType] || mimeType.split("/").pop()?.toUpperCase() || "文件";
}

/**
 * Get file icon color based on file type
 */
function getFileIconColor(mimeType: string): string {
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z")) {
        return "text-yellow-500";
    }
    if (mimeType.includes("msdownload") || mimeType.includes("msdos")) {
        return "text-blue-500";
    }
    if (mimeType.includes("apple-diskimage")) {
        return "text-gray-500";
    }
    return "text-text-muted";
}

/**
 * Get sanitized file metadata for display (without sensitive fields)
 *
 * This function ensures that only safe metadata is exposed to the frontend.
 * It explicitly excludes storage_path and any URL-related fields.
 *
 * Requirements: 2.4 - Do NOT expose download URLs
 */
export function getSafeFileMetadata(file: ProductFile): SafeProductFile {
    const { storage_path, ...safeMetadata } = file;
    return safeMetadata;
}

// ============================================
// Components
// ============================================

/**
 * Single file item display
 *
 * Requirements: 2.1, 2.4, 3.1 - Display file metadata with conditional download button
 */
function FileItem({
    file,
    isPurchased,
    productId,
    isFreeProduct,
}: {
    file: SafeProductFile;
    isPurchased: boolean;
    productId?: string;
    isFreeProduct?: boolean;
}) {
    const fileType = getFileTypeDisplay(file.mime_type);
    const iconColor = getFileIconColor(file.mime_type);

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary/50 hover:bg-bg-secondary transition-colors">
            <div className={cn("flex-shrink-0", iconColor)}>
                <FileIcon className="h-8 w-8" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                    {file.original_filename}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {fileType}
                    </Badge>
                    <span className="text-xs text-text-muted">
                        {formatFileSize(file.file_size)}
                    </span>
                </div>
            </div>
            {/* Download button - Requirements: 3.1 */}
            <div className="flex-shrink-0">
                <DownloadButton
                    fileId={file.id}
                    filename={file.original_filename}
                    isPurchased={isPurchased}
                    productId={productId}
                    isFreeProduct={isFreeProduct}
                    size="sm"
                />
            </div>
        </div>
    );
}

/**
 * ProductFiles component
 *
 * Displays a list of downloadable files for app products.
 * Shows purchase unlock indicator when user hasn't purchased.
 * Includes download buttons for each file.
 *
 * Requirements: 2.1, 2.2, 2.4, 3.1
 */
export function ProductFiles({
    files,
    isPurchased = false,
    productId,
    isFreeProduct = false,
    className,
}: ProductFilesProps) {
    if (!files || files.length === 0) {
        return null;
    }

    // Calculate total size
    const totalSize = files.reduce((sum, file) => sum + file.file_size, 0);

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-text-primary flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    下载内容
                </h3>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                    <HardDrive className="h-4 w-4" />
                    <span>共 {files.length} 个文件</span>
                    <span>·</span>
                    <span>{formatFileSize(totalSize)}</span>
                </div>
            </div>

            {/* Purchase unlock indicator - only show when not purchased */}
            {!isPurchased && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                    <Lock className="h-4 w-4 text-accent" />
                    <span className="text-sm text-accent font-medium">
                        购买后解锁下载
                    </span>
                </div>
            )}

            {/* File list with download buttons */}
            <div className="space-y-2">
                {files.map((file) => (
                    <FileItem
                        key={file.id}
                        file={file}
                        isPurchased={isPurchased}
                        productId={productId}
                        isFreeProduct={isFreeProduct}
                    />
                ))}
            </div>
        </div>
    );
}
