/**
 * Search Results Component
 * 
 * Displays search results in a grouped list with keyboard navigation support.
 * Shows products and brands with their images and names.
 * 
 * Requirements: 4.3, 4.4
 */

import { useRef, useEffect } from "react";
import { cn } from "~/lib/utils";

/**
 * Search result item type
 */
export interface SearchResult {
    type: "product" | "brand";
    id: string;
    name: string;
    image?: string;
    url: string;
    /** Optional subtitle for additional context */
    subtitle?: string;
}

interface SearchResultsProps {
    /** Array of search results */
    results: SearchResult[];
    /** Loading state */
    isLoading: boolean;
    /** Currently selected index for keyboard navigation */
    selectedIndex: number;
    /** Callback when a result is selected */
    onSelect: (result: SearchResult) => void;
    /** Current search query */
    query: string;
}

/**
 * SearchResults - Displays grouped search results with keyboard navigation
 * 
 * Features:
 * - Groups results by type (products, brands)
 * - Keyboard navigation with arrow keys
 * - Visual selection indicator
 * - Loading and empty states
 * 
 * Requirements: 4.3, 4.4
 */
export function SearchResults({
    results,
    isLoading,
    selectedIndex,
    onSelect,
    query,
}: SearchResultsProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    // Scroll selected item into view
    useEffect(() => {
        const selectedItem = itemRefs.current.get(selectedIndex);
        if (selectedItem) {
            selectedItem.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [selectedIndex]);

    // Group results by type
    const productResults = results.filter(r => r.type === "product");
    const brandResults = results.filter(r => r.type === "brand");

    // Calculate global index for each item
    let globalIndex = 0;
    const getGlobalIndex = () => globalIndex++;

    // Empty state - no query
    if (!query.trim()) {
        return (
            <div className="px-3 py-8 text-center text-text-muted">
                <SearchHintIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">输入关键词搜索商品或品牌</p>
            </div>
        );
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="px-3 py-8 text-center text-text-muted">
                <LoadingSpinner className="mx-auto h-6 w-6 mb-2" />
                <p className="text-sm">搜索中...</p>
            </div>
        );
    }

    // Empty state - no results
    if (results.length === 0 && query.trim()) {
        return (
            <div className="px-3 py-8 text-center text-text-muted">
                <EmptyIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">未找到 "{query}" 相关结果</p>
                <p className="text-xs mt-1">尝试其他关键词</p>
            </div>
        );
    }

    return (
        <div
            ref={listRef}
            className="max-h-[400px] overflow-y-auto py-2"
            role="listbox"
            aria-label="搜索结果"
        >
            {/* Brand Results */}
            {brandResults.length > 0 && (
                <ResultGroup title="品牌">
                    {brandResults.map((result) => {
                        const index = getGlobalIndex();
                        return (
                            <ResultItem
                                key={`brand-${result.id}`}
                                ref={(el) => {
                                    if (el) itemRefs.current.set(index, el);
                                }}
                                result={result}
                                isSelected={selectedIndex === index}
                                onSelect={onSelect}
                            />
                        );
                    })}
                </ResultGroup>
            )}

            {/* Product Results */}
            {productResults.length > 0 && (
                <ResultGroup title="商品">
                    {productResults.map((result) => {
                        const index = getGlobalIndex();
                        return (
                            <ResultItem
                                key={`product-${result.id}`}
                                ref={(el) => {
                                    if (el) itemRefs.current.set(index, el);
                                }}
                                result={result}
                                isSelected={selectedIndex === index}
                                onSelect={onSelect}
                            />
                        );
                    })}
                </ResultGroup>
            )}
        </div>
    );
}

/**
 * Result group with title
 */
function ResultGroup({
    title,
    children
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-2">
            <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
                {title}
            </div>
            {children}
        </div>
    );
}

/**
 * Individual result item
 */
import { forwardRef } from "react";

const ResultItem = forwardRef<
    HTMLButtonElement,
    {
        result: SearchResult;
        isSelected: boolean;
        onSelect: (result: SearchResult) => void;
    }
>(({ result, isSelected, onSelect }, ref) => {
    return (
        <button
            ref={ref}
            type="button"
            onClick={() => onSelect(result)}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-left",
                "transition-colors duration-100",
                "hover:bg-bg-secondary",
                isSelected && "bg-accent/10 text-accent"
            )}
            role="option"
            aria-selected={isSelected}
        >
            {/* Image/Icon */}
            <div className={cn(
                "shrink-0 w-10 h-10 rounded-lg overflow-hidden",
                "bg-bg-secondary flex items-center justify-center"
            )}>
                {result.image ? (
                    <img
                        src={result.image}
                        alt={result.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <PlaceholderIcon
                        type={result.type}
                        className="w-5 h-5 text-text-muted"
                    />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className={cn(
                    "font-medium truncate",
                    isSelected ? "text-accent" : "text-text-primary"
                )}>
                    {result.name}
                </div>
                {result.subtitle && (
                    <div className="text-xs text-text-muted truncate">
                        {result.subtitle}
                    </div>
                )}
            </div>

            {/* Type badge */}
            <div className={cn(
                "shrink-0 text-xs px-2 py-0.5 rounded-full",
                result.type === "brand"
                    ? "bg-purple-500/10 text-purple-500"
                    : "bg-blue-500/10 text-blue-500"
            )}>
                {result.type === "brand" ? "品牌" : "商品"}
            </div>

            {/* Arrow indicator when selected */}
            {isSelected && (
                <ArrowRightIcon className="shrink-0 w-4 h-4 text-accent" />
            )}
        </button>
    );
});

ResultItem.displayName = "ResultItem";

// ============================================
// Icons
// ============================================

function SearchHintIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("animate-spin", className)}
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}

function EmptyIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
        </svg>
    );
}

function PlaceholderIcon({
    type,
    className
}: {
    type: "product" | "brand";
    className?: string;
}) {
    if (type === "brand") {
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={className}
            >
                <path d="M12 2L2 7l10 5 10-5-10-5Z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
            </svg>
        );
    }
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
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

export default SearchResults;
