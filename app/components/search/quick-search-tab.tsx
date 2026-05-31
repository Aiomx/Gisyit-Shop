/**
 * Quick Search Tab Component
 * 
 * The quick search functionality extracted from command palette.
 * Provides instant search for products and brands.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useFetcher } from "react-router";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { SearchResults, type SearchResult } from "./search-results";

interface QuickSearchTabProps {
    /** Whether this tab is currently active and visible */
    isOpen: boolean;
    /** Callback when a result is selected */
    onNavigate: (url: string) => void;
    /** Callback to close the palette */
    onClose: () => void;
}

/**
 * QuickSearchTab - Instant search for products and brands
 * 
 * Features:
 * - Real-time search as you type
 * - Keyboard navigation (arrow keys, Enter)
 * - Groups results by type
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export function QuickSearchTab({ isOpen, onNavigate, onClose }: QuickSearchTabProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const fetcher = useFetcher<{ results: SearchResult[] }>();

    // Fetch search results when query changes
    useEffect(() => {
        if (query.trim().length >= 1) {
            fetcher.load(`/api/quick-search?q=${encodeURIComponent(query.trim())}`);
        }
    }, [query]);

    const results = fetcher.data?.results ?? [];
    const isLoading = fetcher.state === "loading";

    // Reset selected index when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Auto-focus input when tab becomes active
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Handle result selection
    const handleSelect = useCallback((result: SearchResult) => {
        onNavigate(result.url);
    }, [onNavigate]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < results.length - 1 ? prev + 1 : prev
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
                break;
            case "Enter":
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case "Escape":
                e.preventDefault();
                onClose();
                break;
        }
    }, [results, selectedIndex, handleSelect, onClose]);

    return (
        <div onKeyDown={handleKeyDown}>
            {/* Search Input */}
            <div className="flex items-center border-b border-border px-3">
                <SearchIcon className="h-4 w-4 text-text-muted shrink-0" />
                <Input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索商品或品牌..."
                    className={cn(
                        "flex-1 border-0 bg-transparent",
                        "focus-visible:ring-0 focus-visible:ring-offset-0",
                        "h-12 text-base placeholder:text-text-muted"
                    )}
                    aria-label="搜索商品或品牌"
                />
            </div>

            {/* Search Results */}
            <SearchResults
                results={results}
                isLoading={isLoading}
                selectedIndex={selectedIndex}
                onSelect={handleSelect}
                query={query}
            />

            {/* Footer with keyboard hints */}
            {results.length > 0 && (
                <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-muted">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-border bg-bg-secondary px-1 py-0.5">↑</kbd>
                            <kbd className="rounded border border-border bg-bg-secondary px-1 py-0.5">↓</kbd>
                            <span>导航</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="rounded border border-border bg-bg-secondary px-1 py-0.5">↵</kbd>
                            <span>选择</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function SearchIcon({ className }: { className?: string }) {
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
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

export default QuickSearchTab;
