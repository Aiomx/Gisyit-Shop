/**
 * AI Search API Route
 *
 * Provides AI-powered product recommendation functionality.
 * Uses DeepSeek Reasoner API via MCP Client.
 *
 * Requirements: 5.1, 5.5, 5.6
 */

import {
    getAIRecommendations,
    getAIRecommendationsStream,
} from "~/lib/ai/ai-search.server";

type ActionArgs = { request: Request };

/**
 * AI Search Action
 *
 * Handles POST requests for AI-powered product recommendations.
 * Supports both streaming and non-streaming responses.
 *
 * Request Body:
 * - query: Natural language search query
 * - stream: Whether to use streaming response (optional, default: false)
 *
 * Requirements: 5.1, 5.5, 5.6
 */
export async function action({ request }: ActionArgs) {
    // Only allow POST requests
    if (request.method !== "POST") {
        return Response.json(
            { error: "Method not allowed" },
            { status: 405 }
        );
    }

    try {
        // Parse request body
        const body = await request.json();
        const query = body.query as string;
        const stream = body.stream as boolean;

        // Validate query
        if (!query || typeof query !== "string") {
            return Response.json(
                { error: "请输入搜索内容" },
                { status: 400 }
            );
        }

        // Trim and validate query length
        const trimmedQuery = query.trim();
        if (trimmedQuery.length === 0) {
            return Response.json(
                { error: "请输入搜索内容" },
                { status: 400 }
            );
        }

        if (trimmedQuery.length > 500) {
            return Response.json(
                { error: "搜索内容过长，请简化您的问题" },
                { status: 400 }
            );
        }

        // Handle streaming response
        if (stream) {
            return handleStreamingResponse(trimmedQuery);
        }

        // Handle non-streaming response
        return handleNonStreamingResponse(trimmedQuery);
    } catch (error) {
        console.error("[AI Search API] Error:", error);

        // Handle JSON parse errors
        if (error instanceof SyntaxError) {
            return Response.json(
                { error: "请求格式错误" },
                { status: 400 }
            );
        }

        // Requirements: 5.6 - User-friendly error message
        return Response.json(
            { error: "AI 服务暂时不可用，请稍后重试" },
            { status: 500 }
        );
    }
}

/**
 * Handle non-streaming AI search response
 *
 * Requirements: 5.1, 5.5
 */
async function handleNonStreamingResponse(query: string): Promise<Response> {
    const result = await getAIRecommendations(query);

    if (result.error) {
        // Requirements: 5.6 - User-friendly error message
        return Response.json(
            {
                recommendations: [],
                reasoning: "",
                error: result.error,
            },
            { status: 200 } // Return 200 with error in body for graceful handling
        );
    }

    return Response.json({
        recommendations: result.recommendations,
        reasoning: result.reasoning,
    });
}

/**
 * Handle streaming AI search response
 *
 * Uses Server-Sent Events (SSE) for streaming.
 *
 * Requirements: 5.1, 5.2, 5.5
 */
async function handleStreamingResponse(query: string): Promise<Response> {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const generator = getAIRecommendationsStream(query);
                let finalResult = null;

                // Stream content chunks
                while (true) {
                    const { value, done } = await generator.next();

                    if (done) {
                        // Generator returned final result
                        finalResult = value;
                        break;
                    }

                    // Send content chunk as SSE event
                    const event = `data: ${JSON.stringify({ type: "content", content: value })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                }

                // Send final result with recommendations
                if (finalResult) {
                    const event = `data: ${JSON.stringify({
                        type: "done",
                        recommendations: finalResult.recommendations,
                        error: finalResult.error,
                    })}\n\n`;
                    controller.enqueue(encoder.encode(event));
                }

                controller.close();
            } catch (error) {
                console.error("[AI Search API] Stream error:", error);

                // Send error event
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "AI 服务暂时不可用，请稍后重试";

                const event = `data: ${JSON.stringify({
                    type: "error",
                    error: errorMessage,
                })}\n\n`;

                controller.enqueue(encoder.encode(event));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

/**
 * Loader for GET requests - returns method not allowed
 */
export async function loader() {
    return Response.json(
        { error: "Method not allowed. Use POST request." },
        { status: 405 }
    );
}
