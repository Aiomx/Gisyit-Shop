/**
 * AI MCP Client (Server-side only)
 *
 * This module provides a client for interacting with DeepSeek Reasoner API.
 * All AI operations go through this client to maintain security and proper
 * separation of concerns.
 *
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 *
 * Requirements: 5.1, 6.3
 */

// ============================================
// Types
// ============================================

/**
 * AI MCP Error Codes
 */
export type AIMCPErrorCode =
    | "NETWORK_ERROR"
    | "API_KEY_MISSING"
    | "API_ERROR"
    | "RATE_LIMIT"
    | "INVALID_RESPONSE"
    | "TIMEOUT"
    | "STREAM_ERROR";

/**
 * AI MCP Error
 */
export interface AIMCPError {
    code: AIMCPErrorCode;
    message: string;
    details?: string;
}

/**
 * User-friendly error messages for AI MCP errors
 */
export const aiErrorMessages: Record<AIMCPErrorCode, string> = {
    NETWORK_ERROR: "网络连接失败，请稍后重试",
    API_KEY_MISSING: "AI 服务配置错误",
    API_ERROR: "AI 服务暂时不可用，请稍后重试",
    RATE_LIMIT: "请求过于频繁，请稍后重试",
    INVALID_RESPONSE: "AI 响应格式错误",
    TIMEOUT: "AI 服务响应超时，请稍后重试",
    STREAM_ERROR: "流式响应中断",
};

/**
 * AI MCP Response wrapper
 */
export interface AIMCPResponse<T> {
    data: T | null;
    error: AIMCPError | null;
}

/**
 * DeepSeek API Message
 */
export interface DeepSeekMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

/**
 * DeepSeek API Request
 */
export interface DeepSeekRequest {
    model: string;
    messages: DeepSeekMessage[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
}

/**
 * DeepSeek API Response (non-streaming)
 */
export interface DeepSeekResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * DeepSeek Streaming Chunk
 */
export interface DeepSeekStreamChunk {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        delta: {
            role?: string;
            content?: string;
        };
        finish_reason: string | null;
    }>;
}

// ============================================
// Configuration
// ============================================

/**
 * Get DeepSeek API key from environment variables
 * Requirements: 6.3, 6.5
 */
function getDeepSeekApiKey(): string | null {
    return process.env.DEEPSEEK_API_KEY || null;
}

/**
 * DeepSeek API base URL
 */
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

/**
 * Default model to use
 */
const DEFAULT_MODEL = "deepseek-reasoner";

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 60000; // 60 seconds

// ============================================
// Error Handling
// ============================================

/**
 * Handle AI MCP errors and convert to user-friendly format
 */
export function handleAIMCPError(
    error: unknown,
    fallbackCode: AIMCPErrorCode = "API_ERROR"
): AIMCPError {
    if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
            code: "NETWORK_ERROR",
            message: aiErrorMessages.NETWORK_ERROR,
        };
    }

    if (error instanceof Error) {
        // Check for timeout
        if (error.name === "AbortError") {
            return {
                code: "TIMEOUT",
                message: aiErrorMessages.TIMEOUT,
            };
        }

        return {
            code: fallbackCode,
            message: aiErrorMessages[fallbackCode],
            details: error.message,
        };
    }

    return {
        code: fallbackCode,
        message: aiErrorMessages[fallbackCode],
    };
}

// ============================================
// AI MCP Client Class
// ============================================

class AIMCPClient {
    /**
     * Send a chat completion request to DeepSeek API (non-streaming)
     *
     * Requirements: 5.1, 6.3
     */
    async chat(
        messages: DeepSeekMessage[],
        options: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
        } = {}
    ): Promise<AIMCPResponse<string>> {
        const apiKey = getDeepSeekApiKey();

        if (!apiKey) {
            console.error("[AI MCP] API key not configured");
            return {
                data: null,
                error: {
                    code: "API_KEY_MISSING",
                    message: aiErrorMessages.API_KEY_MISSING,
                },
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

            const response = await fetch(DEEPSEEK_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: options.model || DEFAULT_MODEL,
                    messages,
                    stream: false,
                    max_tokens: options.maxTokens || 2048,
                    temperature: options.temperature || 0.7,
                } as DeepSeekRequest),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[AI MCP] API error:", response.status, errorText);

                if (response.status === 429) {
                    return {
                        data: null,
                        error: {
                            code: "RATE_LIMIT",
                            message: aiErrorMessages.RATE_LIMIT,
                        },
                    };
                }

                return {
                    data: null,
                    error: {
                        code: "API_ERROR",
                        message: aiErrorMessages.API_ERROR,
                        details: errorText,
                    },
                };
            }

            const data = (await response.json()) as DeepSeekResponse;

            if (!data.choices || data.choices.length === 0) {
                return {
                    data: null,
                    error: {
                        code: "INVALID_RESPONSE",
                        message: aiErrorMessages.INVALID_RESPONSE,
                    },
                };
            }

            return {
                data: data.choices[0].message.content,
                error: null,
            };
        } catch (error) {
            console.error("[AI MCP] Error:", error);
            return {
                data: null,
                error: handleAIMCPError(error),
            };
        }
    }

    /**
     * Send a streaming chat completion request to DeepSeek API
     *
     * Returns an async generator that yields content chunks.
     *
     * Requirements: 5.1, 5.2, 6.3
     */
    async *chatStream(
        messages: DeepSeekMessage[],
        options: {
            model?: string;
            maxTokens?: number;
            temperature?: number;
        } = {}
    ): AsyncGenerator<string, void, unknown> {
        const apiKey = getDeepSeekApiKey();

        if (!apiKey) {
            console.error("[AI MCP] API key not configured");
            throw new Error(aiErrorMessages.API_KEY_MISSING);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
            const response = await fetch(DEEPSEEK_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: options.model || DEFAULT_MODEL,
                    messages,
                    stream: true,
                    max_tokens: options.maxTokens || 2048,
                    temperature: options.temperature || 0.7,
                } as DeepSeekRequest),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[AI MCP] API error:", response.status, errorText);

                if (response.status === 429) {
                    throw new Error(aiErrorMessages.RATE_LIMIT);
                }

                throw new Error(aiErrorMessages.API_ERROR);
            }

            if (!response.body) {
                throw new Error(aiErrorMessages.INVALID_RESPONSE);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmedLine = line.trim();

                    if (!trimmedLine || trimmedLine === "data: [DONE]") {
                        continue;
                    }

                    if (trimmedLine.startsWith("data: ")) {
                        try {
                            const jsonStr = trimmedLine.slice(6);
                            const chunk = JSON.parse(jsonStr) as DeepSeekStreamChunk;

                            if (chunk.choices && chunk.choices.length > 0) {
                                const content = chunk.choices[0].delta?.content;
                                if (content) {
                                    yield content;
                                }
                            }
                        } catch (parseError) {
                            // Skip invalid JSON chunks
                            console.warn("[AI MCP] Failed to parse chunk:", trimmedLine);
                        }
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(aiErrorMessages.TIMEOUT);
            }

            throw error;
        }
    }

    /**
     * Check if the AI service is available
     */
    isAvailable(): boolean {
        return !!getDeepSeekApiKey();
    }
}

// Export singleton instance
export const aiMCP = new AIMCPClient();
