/**
 * DownloadButton Component
 *
 * Handles file download for purchased products.
 * Shows download button for purchased products, purchase prompt for non-purchased.
 *
 * Requirements: 3.1, 3.4
 */

import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Download, Loader2, ShoppingCart, AlertCircle } from "lucide-react";
import type { DownloadApiResponse } from "~/lib/download/types";

// ============================================
// Type Definitions
// ============================================

export interface DownloadButtonProps {
    /** File ID for download */
    fileId: string;
    /** Original filename for display */
    filename: string;
    /** Whether the user has purchased this product */
    isPurchased: boolean;
    /** Product ID for purchase link */
    productId?: string;
    /** Whether this is a free product (uses different download flow) */
    isFreeProduct?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** Size variant */
    size?: "default" | "sm" | "icon";
}

// ============================================
// Component
// ============================================

/**
 * DownloadButton Component
 *
 * Displays a download button for purchased products or a purchase prompt
 * for non-purchased products. Handles the download flow by calling the
 * download API and redirecting to the signed URL.
 *
 * For free products, uses the server action flow instead of the download API.
 *
 * Requirements: 3.1, 3.4
 */
export function DownloadButton({
    fileId,
    filename,
    isPurchased,
    productId,
    isFreeProduct = false,
    className,
    size = "sm",
}: DownloadButtonProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fetcher = useFetcher<{ success: boolean; url?: string; filename?: string; error?: { message: string } }>();
    const prevFetcherState = useRef(fetcher.state);

    // Handle fetcher response for free downloads
    // Track state transitions to detect when a submission completes
    useEffect(() => {
        const wasSubmitting = prevFetcherState.current === "submitting" || prevFetcherState.current === "loading";
        const isNowIdle = fetcher.state === "idle";

        // Update previous state
        prevFetcherState.current = fetcher.state;

        // Only process when transitioning from submitting/loading to idle
        if (wasSubmitting && isNowIdle && fetcher.data) {
            console.log("[DownloadButton] Fetcher completed with data:", fetcher.data);

            if (fetcher.data.success && fetcher.data.url) {
                // Initiate download using a hidden link element
                console.log("[DownloadButton] Initiating download:", fetcher.data.url);
                const link = document.createElement("a");
                link.href = fetcher.data.url;
                link.download = fetcher.data.filename || filename;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                document.body.appendChild(link);
                link.click();
                // Clean up after a short delay
                setTimeout(() => {
                    document.body.removeChild(link);
                }, 100);
            } else if (fetcher.data.error) {
                setError(fetcher.data.error.message || "下载失败");
            }
        }
    }, [fetcher.state, fetcher.data, filename]);

    /**
     * Handle download click for paid products
     *
     * Calls the download API to get a signed URL, then initiates
     * the browser's native download.
     *
     * Requirements: 3.1, 3.2, 3.5
     */
    const handlePaidDownload = async () => {
        setIsDownloading(true);
        setError(null);

        try {
            // Call download API to get signed URL
            const response = await fetch(`/api/download/${fileId}`);
            const data: DownloadApiResponse = await response.json();

            if (!data.success || !data.url) {
                // Handle specific error cases
                if (response.status === 401) {
                    setError("请先登录后再下载");
                } else if (response.status === 403) {
                    setError("请先购买此商品");
                } else {
                    setError(data.error || "下载失败，请稍后重试");
                }
                return;
            }

            // Initiate download using the signed URL
            // Create a temporary link and click it to trigger download
            const link = document.createElement("a");
            link.href = data.url;
            link.download = data.filename || filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("[DownloadButton] Download failed:", err);
            setError("网络错误，请稍后重试");
        } finally {
            setIsDownloading(false);
        }
    };

    /**
     * Handle download click for free products
     *
     * Uses the server action flow to get a signed URL.
     *
     * Requirements: 4.1, 5.2
     */
    const handleFreeDownload = () => {
        if (!productId) {
            setError("商品信息缺失");
            return;
        }

        setError(null);
        fetcher.submit(
            {
                intent: "free-download",
                productId,
                fileId,
            },
            {
                method: "POST",
                action: `/product/${productId}`,
            }
        );
    };

    const handleDownload = isFreeProduct ? handleFreeDownload : handlePaidDownload;
    const isLoading = isDownloading || fetcher.state === "submitting";

    // Show purchase prompt for non-purchased products
    // Requirements: 3.4
    if (!isPurchased) {
        return (
            <Button
                variant="outline"
                size={size}
                className={className}
                asChild
            >
                <a href={productId ? `/product/${productId}` : "#"}>
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span className="ml-1">购买后下载</span>
                </a>
            </Button>
        );
    }

    // Show download button for purchased products
    // Requirements: 3.1
    return (
        <div className="flex items-center gap-2">
            <Button
                variant="default"
                size={size}
                className={className}
                onClick={handleDownload}
                disabled={isLoading}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="ml-1">获取下载链接...</span>
                    </>
                ) : (
                    <>
                        <Download className="h-3.5 w-3.5" />
                        <span className="ml-1">下载</span>
                    </>
                )}
            </Button>
            {error && (
                <span className="text-xs text-error flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </span>
            )}
        </div>
    );
}
