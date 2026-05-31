/**
 * AI Recommendation Display Component
 * 
 * Displays AI-generated product recommendations with streaming text effect.
 * Parses and displays product links, handles error states with retry option.
 * 
 * Requirements: 5.2, 5.4, 5.6
 */

import { useMemo } from "react";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import { StreamingText } from "~/components/ui/text-generate-effect";

/**
 * AI Recommendation item from the API
 */
export interface AIRecommendationItem {
    productId: string;
    productName: string;
    reason: string;
}

interface AIRecommendationProps {
    /** The AI-generated reasoning text */
    reasoning: string;
    /** List of recommended products */
    recommendations: AIRecommendationItem[];
    /** Whether the response is still streaming */
    isStreaming?: boolean;
    /** Error message if any */
    error?: string;
    /** Callback to retry the search */
    onRetry?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * AIRecommendation - Displays AI recommendations with streaming effect
 * 
 * Features:
 * - Streaming text display using TextGenerateEffect
 * - Clickable product links
 * - Error state with retry option
 * - Loading indicator during streaming
 * 
 * Requirements: 5.2, 5.4, 5.6
 */
export function AIRecommendation({
    reasoning,
    recommendations,
    isStreaming = false,
    error,
    onRetry,
    className,
}: AIRecommendationProps) {
    // Parse product IDs from reasoning text and create links
    const parsedContent = useMemo(() => {
        if (!reasoning) return null;
        return parseReasoningWithLinks(reasoning, recommendations);
    }, [reasoning, recommendations]);

    // Error state
    if (error) {
        return (
            <div className={cn("p-4", className)}>
                <ErrorState error={error} onRetry={onRetry} />
            </div>
        );
    }

    // Empty state
    if (!reasoning && !isStreaming) {
        return (
            <div className={cn("p-4 text-center text-text-muted", className)}>
                <SparklesIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">输入问题，让 AI 为你推荐商品</p>
            </div>
        );
    }

    return (
        <div className={cn("p-4", className)}>
            {/* AI Response Header */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                    <SparklesIcon className="w-4 h-4 text-accent" />
                </div>
                <span className="text-sm font-medium text-text-primary">AI 推荐</span>
                {isStreaming && (
                    <span className="text-xs text-text-muted animate-pulse">思考中...</span>
                )}
            </div>

            {/* Streaming Text Content */}
            <div className="prose prose-sm max-w-none">
                {parsedContent ? (
                    <div className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                        {parsedContent}
                        {isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-accent animate-pulse align-middle" />
                        )}
                    </div>
                ) : (
                    <StreamingText
                        text={reasoning}
                        isStreaming={isStreaming}
                        className="text-text-secondary"
                    />
                )}
            </div>

            {/* Product Cards (shown after streaming completes) */}
            {!isStreaming && recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-text-muted mb-2">推荐商品</p>
                    <div className="flex flex-wrap gap-2">
                        {recommendations.map((rec) => (
                            <ProductChip
                                key={rec.productId}
                                productId={rec.productId}
                                productName={rec.productName}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Parse reasoning text and replace product IDs with clickable links
 * Requirements: 5.4
 */
function parseReasoningWithLinks(
    reasoning: string,
    recommendations: AIRecommendationItem[]
): React.ReactNode {
    // Create a map of product IDs to names
    const productMap = new Map(
        recommendations.map((r) => [r.productId, r.productName])
    );

    // UUID pattern
    const uuidPattern = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

    // Split text by UUIDs
    const parts = reasoning.split(uuidPattern);

    return parts.map((part, index) => {
        // Check if this part is a UUID
        if (uuidPattern.test(part)) {
            uuidPattern.lastIndex = 0; // Reset regex
            const productName = productMap.get(part.toLowerCase());
            if (productName) {
                return (
                    <Link
                        key={index}
                        to={`/product/${part}`}
                        className="text-accent hover:underline font-medium"
                    >
                        {part}
                    </Link>
                );
            }
        }
        return <span key={index}>{part}</span>;
    });
}

/**
 * Product chip component for quick navigation
 * Requirements: 5.4
 */
function ProductChip({
    productId,
    productName,
}: {
    productId: string;
    productName: string;
}) {
    return (
        <Link
            to={`/product/${productId}`}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "bg-accent/10 text-accent text-sm",
                "hover:bg-accent/20 transition-colors",
                "border border-accent/20"
            )}
        >
            <PackageIcon className="w-3.5 h-3.5" />
            <span className="truncate max-w-[150px]">{productName}</span>
            <ArrowRightIcon className="w-3 h-3 opacity-60" />
        </Link>
    );
}

/**
 * Error state with retry option
 * Requirements: 5.6
 */
function ErrorState({
    error,
    onRetry,
}: {
    error: string;
    onRetry?: () => void;
}) {
    return (
        <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-error/10 flex items-center justify-center">
                <AlertIcon className="w-6 h-6 text-error" />
            </div>
            <p className="text-sm text-text-primary mb-1">出错了</p>
            <p className="text-xs text-text-muted mb-4">{error}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-md",
                        "bg-accent text-white text-sm",
                        "hover:bg-accent-hover transition-colors"
                    )}
                >
                    <RefreshIcon className="w-4 h-4" />
                    重试
                </button>
            )}
        </div>
    );
}

// ============================================
// Icons
// ============================================

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
        </svg>
    );
}

function PackageIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m7.5 4.27 9 5.15" />
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
        </svg>
    );
}

function ArrowRightIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    );
}

function AlertIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" x2="12" y1="8" y2="12" />
            <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
    );
}

function RefreshIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
        </svg>
    );
}

export default AIRecommendation;
