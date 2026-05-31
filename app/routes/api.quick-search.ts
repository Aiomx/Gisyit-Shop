/**
 * Quick Search API Route
 * 
 * Provides combined search functionality for products and brands.
 * Used by the Command Palette component.
 * 
 * Requirements: 4.3
 */

import { quickSearch } from "~/lib/search/quick-search.server";

type LoaderArgs = { request: Request };

/**
 * Quick Search Loader
 * 
 * Searches products and brands based on query parameter.
 * Returns combined results with type, id, name, image, and url.
 * 
 * Query Parameters:
 * - q: Search query string
 * 
 * Requirements: 4.3
 */
export async function loader({ request }: LoaderArgs) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";

    const result = await quickSearch(query);

    if (result.error) {
        return Response.json(
            { results: [], error: result.error },
            { status: 500 }
        );
    }

    return Response.json({
        results: result.results,
    });
}
