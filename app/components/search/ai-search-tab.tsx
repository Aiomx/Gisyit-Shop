/**
 * AI Search Tab Component
 * 
 * The AI-powered search functionality for the command palette.
 * Uses natural language to find and recommend products.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5, 5.6
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "~/lib/utils";
import { AISearchInput } from "./ai-search-input";
import { AIRecommendation, type AIRecommendationItem } from "./ai-recommendation";

interface AISearchTabProps {
    /** Whether this tab is currently active and visible */
    isOpen: boolean;
    /** Callback when a product is selected */
    onNavigate: (url: string) => void;
}

interface AISearchState {
    reasoning: string;
    recommendations: AIRecommendationItem[];
    isStreaming: boolean;
    error?: string;
    lastQuery?: string;
}

/**
 * AISearchTab - Natural language AI search
 * 
 * Features:
 * - Natural language input
 * - Streaming AI response
 * - Product recommendations with links
 * - Error handling with retry
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5, 5.6
 */
export function AISearchTab({ isOpen, onNavigate }: AISearchTabProps) {
    const [state, setState] = useState<AISearchState>({
        reasoning: "",
        recommendations: [],
        isStreaming: false,
    });
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount or tab change
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    // Reset state when tab becomes inactive
    useEffect(() => {
        if (!isOpen) {
            abortControllerRef.current?.abort();
        }
    }, [isOpen]);

    /**
     * Handle AI search submission
     * Requirements: 5.1, 5.5
     */
    const handleSearch = useCallback(async (query: string) => {
        // Abort any existing request
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        // Reset state and start streaming
        setState({
            reasoning: "",
            recommendations: [],
            isStreaming: true,
            error: undefined,
            lastQuery: query,
        });

        try {
            const response = await fetch("/api/ai-search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, stream: true }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "请求失败");
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("无法读取响应");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process SSE events
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === "content") {
                                // Append content chunk
                                setState(prev => ({
                                    ...prev,
                                    reasoning: prev.reasoning + data.content,
                                }));
                            } else if (data.type === "done") {
                                // Streaming complete
                                setState(prev => ({
                                    ...prev,
                                    recommendations: data.recommendations || [],
                                    isStreaming: false,
                                    error: data.error,
                                }));
                            } else if (data.type === "error") {
                                // Error occurred
                                setState(prev => ({
                                    ...prev,
                                    isStreaming: false,
                                    error: data.error,
                                }));
                            }
                        } catch (e) {
                            console.error("[AI Search] Failed to parse SSE data:", e);
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore abort errors
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }

            // Requirements: 5.6 - User-friendly error message
            const errorMessage = error instanceof Error
                ? error.message
                : "AI 服务暂时不可用，请稍后重试";

            setState(prev => ({
                ...prev,
                isStreaming: false,
                error: errorMessage,
            }));
        }
    }, []);

    /**
     * Handle retry
     * Requirements: 5.6
     */
    const handleRetry = useCallback(() => {
        if (state.lastQuery) {
            handleSearch(state.lastQuery);
        }
    }, [state.lastQuery, handleSearch]);

    return (
        <div className="flex flex-col">
            {/* AI Search Input */}
            <div className="p-3 border-b border-border">
                <AISearchInput
                    onSearch={handleSearch}
                    isLoading={state.isStreaming}
                    autoFocus={isOpen}
                />
            </div>

            {/* AI Recommendation Display */}
            <div className="max-h-[400px] overflow-y-auto">
                <AIRecommendation
                    reasoning={state.reasoning}
                    recommendations={state.recommendations}
                    isStreaming={state.isStreaming}
                    error={state.error}
                    onRetry={handleRetry}
                />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" />
                    <span>由 AI 提供智能推荐</span>
                </span>
                {state.recommendations.length > 0 && (
                    <span>找到 {state.recommendations.length} 个推荐</span>
                )}
            </div>
        </div>
    );
}

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

export default AISearchTab;
