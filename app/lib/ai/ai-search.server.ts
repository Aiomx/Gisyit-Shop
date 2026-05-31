/**
 * AI Search Server Action (Server-side only)
 *
 * This module provides AI-powered product recommendation functionality
 * using DeepSeek Reasoner API.
 *
 * IMPORTANT: This file should only be used in server-side code (loaders/actions).
 * The .server.ts suffix ensures it's not bundled for the client.
 *
 * Requirements: 5.1, 5.3, 6.4
 */

import { aiMCP, type DeepSeekMessage } from "./ai-mcp-client.server";
import { getSupabaseClient } from "~/lib/supabase/client.server";
import type { Product } from "~/lib/supabase/types";

// ============================================
// Types
// ============================================

/**
 * AI Recommendation Result
 */
export interface AIRecommendation {
    productId: string;
    productName: string;
    reason: string;
}

/**
 * AI Search Response
 */
export interface AISearchResponse {
    recommendations: AIRecommendation[];
    reasoning: string;
    error?: string;
}

/**
 * Product context for AI prompt
 */
interface ProductContext {
    id: string;
    name: string;
    subtitle?: string;
    description?: string;
    product_type: string;
    category_name?: string;
}

// ============================================
// Sensitive Information Patterns
// Requirements: 6.4
// ============================================

/**
 * Patterns to filter from AI responses
 */
const SENSITIVE_PATTERNS = [
    // API keys and secrets
    /sk[-_][a-zA-Z0-9]{20,}/g,
    /api[-_]?key[=:]\s*["']?[a-zA-Z0-9-_]+["']?/gi,
    /secret[=:]\s*["']?[a-zA-Z0-9-_]+["']?/gi,
    /password[=:]\s*["']?[^\s"']+["']?/gi,
    /token[=:]\s*["']?[a-zA-Z0-9-_.]+["']?/gi,

    // Internal paths - Unix style
    /\/app\/lib\/[a-zA-Z0-9/_.-]+/g,
    /\/home\/[a-zA-Z0-9/_.-]+/g,
    /\/var\/www\/[a-zA-Z0-9/_.-]+/g,

    // Internal paths - Windows style
    /[A-Z]:\\[a-zA-Z0-9\\_.-]+/g,

    // Database connection strings
    /postgres(ql)?:\/\/[^\s]+/gi,
    /mysql:\/\/[^\s]+/gi,
    /mongodb(\+srv)?:\/\/[^\s]+/gi,

    // Environment variables
    /process\.env\.[A-Z_]+/g,
    /SUPABASE_[A-Z_]+/g,
    /DEEPSEEK_[A-Z_]+/g,
    /STRIPE_[A-Z_]+/g,
];

/**
 * Filter sensitive information from AI response
 * Requirements: 6.4
 */
export function sanitizeAIResponse(response: string): string {
    let sanitized = response;

    for (const pattern of SENSITIVE_PATTERNS) {
        sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    return sanitized;
}

/**
 * Check if a response contains sensitive information
 */
export function containsSensitiveInfo(response: string): boolean {
    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(response)) {
            // Reset regex lastIndex for global patterns
            pattern.lastIndex = 0;
            return true;
        }
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
    }
    return false;
}

// ============================================
// Product Context Building
// ============================================

/**
 * Fetch active products for AI context
 */
async function getProductsForContext(limit = 50): Promise<ProductContext[]> {
    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("products")
            .select(`
                id,
                name,
                subtitle,
                description,
                product_type,
                category:product_categories(name)
            `)
            .eq("is_active", true)
            .limit(limit);

        if (error) {
            console.error("[AI Search] Error fetching products:", error);
            return [];
        }

        return (data || []).map((p) => ({
            id: p.id,
            name: p.name,
            subtitle: p.subtitle || undefined,
            description: p.description || undefined,
            product_type: p.product_type,
            category_name: (p.category as { name: string } | null)?.name,
        }));
    } catch (err) {
        console.error("[AI Search] Error in getProductsForContext:", err);
        return [];
    }
}

/**
 * Build product context string for AI prompt
 */
function buildProductContextString(products: ProductContext[]): string {
    return products
        .map((p) => {
            const parts = [`- ${p.name} (ID: ${p.id})`];
            if (p.subtitle) parts.push(`  简介: ${p.subtitle}`);
            if (p.category_name) parts.push(`  分类: ${p.category_name}`);
            if (p.product_type) parts.push(`  类型: ${p.product_type}`);
            return parts.join("\n");
        })
        .join("\n\n");
}

// ============================================
// Product Validation
// Requirements: 5.3
// ============================================

/**
 * Validate that recommended product IDs exist in database
 * Requirements: 5.3
 */
export async function validateProductIds(
    productIds: string[]
): Promise<string[]> {
    if (productIds.length === 0) return [];

    try {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from("products")
            .select("id")
            .in("id", productIds)
            .eq("is_active", true);

        if (error) {
            console.error("[AI Search] Error validating products:", error);
            return [];
        }

        return (data || []).map((p) => p.id);
    } catch (err) {
        console.error("[AI Search] Error in validateProductIds:", err);
        return [];
    }
}

/**
 * Extract product IDs from AI response text
 */
export function extractProductIds(text: string): string[] {
    // Match UUID pattern
    const uuidPattern =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const matches = text.match(uuidPattern);
    return matches ? [...new Set(matches)] : [];
}

// ============================================
// AI Search Functions
// ============================================

/**
 * Build the system prompt for AI recommendations
 */
function buildSystemPrompt(): string {
    return `你是一个专业的商品推荐助手。你的任务是根据用户的需求，从商品列表中推荐最合适的商品。

规则：
1. 只推荐列表中存在的商品，不要编造商品
2. 每次推荐 1-5 个最相关的商品
3. 对每个推荐的商品，简要说明推荐理由
4. 使用商品的完整 ID（UUID 格式）
5. 如果没有合适的商品，诚实地告诉用户
6. 回复使用中文

回复格式：
首先简要分析用户需求，然后列出推荐商品：

推荐商品：
1. [商品名称] (ID: [商品ID])
   推荐理由：[简要说明]

2. [商品名称] (ID: [商品ID])
   推荐理由：[简要说明]

...`;
}

/**
 * Build the user prompt with product context
 */
function buildUserPrompt(query: string, productContext: string): string {
    return `用户需求：${query}

可选商品列表：
${productContext}

请根据用户需求推荐合适的商品。`;
}

/**
 * Get AI recommendations for a search query (non-streaming)
 *
 * Requirements: 5.1, 5.3, 6.4
 */
export async function getAIRecommendations(
    query: string
): Promise<AISearchResponse> {
    // Check if AI service is available
    if (!aiMCP.isAvailable()) {
        return {
            recommendations: [],
            reasoning: "",
            error: "AI 服务未配置",
        };
    }

    // Fetch product context
    const products = await getProductsForContext();

    if (products.length === 0) {
        return {
            recommendations: [],
            reasoning: "暂无可推荐的商品",
            error: undefined,
        };
    }

    // Build prompts
    const productContext = buildProductContextString(products);
    const messages: DeepSeekMessage[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(query, productContext) },
    ];

    // Call AI
    const response = await aiMCP.chat(messages);

    if (response.error) {
        return {
            recommendations: [],
            reasoning: "",
            error: response.error.message,
        };
    }

    if (!response.data) {
        return {
            recommendations: [],
            reasoning: "",
            error: "AI 响应为空",
        };
    }

    // Sanitize response (Requirements: 6.4)
    const sanitizedResponse = sanitizeAIResponse(response.data);

    // Extract and validate product IDs (Requirements: 5.3)
    const extractedIds = extractProductIds(sanitizedResponse);
    const validIds = await validateProductIds(extractedIds);

    // Build recommendations
    const recommendations: AIRecommendation[] = validIds.map((id) => {
        const product = products.find((p) => p.id === id);
        return {
            productId: id,
            productName: product?.name || "未知商品",
            reason: "", // Reason is embedded in the reasoning text
        };
    });

    return {
        recommendations,
        reasoning: sanitizedResponse,
        error: undefined,
    };
}

/**
 * Get AI recommendations as a stream
 *
 * Returns an async generator that yields content chunks.
 *
 * Requirements: 5.1, 5.2, 6.4
 */
export async function* getAIRecommendationsStream(
    query: string
): AsyncGenerator<string, AISearchResponse, unknown> {
    // Check if AI service is available
    if (!aiMCP.isAvailable()) {
        return {
            recommendations: [],
            reasoning: "",
            error: "AI 服务未配置",
        };
    }

    // Fetch product context
    const products = await getProductsForContext();

    if (products.length === 0) {
        yield "暂无可推荐的商品";
        return {
            recommendations: [],
            reasoning: "暂无可推荐的商品",
            error: undefined,
        };
    }

    // Build prompts
    const productContext = buildProductContextString(products);
    const messages: DeepSeekMessage[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(query, productContext) },
    ];

    // Collect full response for post-processing
    let fullResponse = "";

    try {
        // Stream AI response
        for await (const chunk of aiMCP.chatStream(messages)) {
            // Sanitize each chunk (Requirements: 6.4)
            const sanitizedChunk = sanitizeAIResponse(chunk);
            fullResponse += sanitizedChunk;
            yield sanitizedChunk;
        }

        // Extract and validate product IDs (Requirements: 5.3)
        const extractedIds = extractProductIds(fullResponse);
        const validIds = await validateProductIds(extractedIds);

        // Build recommendations
        const recommendations: AIRecommendation[] = validIds.map((id) => {
            const product = products.find((p) => p.id === id);
            return {
                productId: id,
                productName: product?.name || "未知商品",
                reason: "",
            };
        });

        return {
            recommendations,
            reasoning: fullResponse,
            error: undefined,
        };
    } catch (error) {
        const errorMessage =
            error instanceof Error ? error.message : "AI 服务错误";
        return {
            recommendations: [],
            reasoning: fullResponse,
            error: errorMessage,
        };
    }
}
