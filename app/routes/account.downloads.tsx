/**
 * Account Downloads Page Route
 *
 * Displays user's purchased products with downloadable files.
 * Requires user authentication.
 *
 * Requirements: 4.1
 */

import type { LoaderFunctionArgs } from "react-router";
import { RootLayout } from "~/components/layout";
import { DownloadsList } from "~/components/account";
import { getUserDownloads } from "~/lib/download/user-downloads.server";
import type { UserDownloadItem } from "~/lib/download/types";
import type { UserMenuInfo } from "~/components/auth";

/**
 * Downloads Loader - Load user's downloadable products
 * Requirements: 4.1
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const { requireUserSession, getUserIdFromSession, getUserForHeader } = await import("~/lib/auth/auth.server");

    // Require authentication
    await requireUserSession(request);

    // Get user ID from session
    const userId = await getUserIdFromSession(request);

    if (!userId) {
        throw new Response(null, {
            status: 302,
            headers: {
                Location: "/auth/login?returnTo=/account/downloads",
            },
        });
    }

    // Get user info for header
    const user = await getUserForHeader(request);

    // Fetch user's downloads
    const result = await getUserDownloads(userId);

    if (!result.success) {
        console.error("Failed to load downloads:", result.error);
        return {
            downloads: [],
            user,
            error: result.error,
        };
    }

    return {
        downloads: result.downloads || [],
        user,
        error: null,
    };
}

export function meta() {
    return [
        { title: "我的下载 - Gisyit Shop" },
        { name: "description", content: "下载您购买的应用和文档" },
    ];
}

interface LoaderData {
    downloads: UserDownloadItem[];
    user: UserMenuInfo;
    error: { code: string; message: string } | null;
}

/**
 * Account Downloads Page Component
 * Requirements: 4.1
 */
export default function AccountDownloadsRoute({ loaderData }: { loaderData: LoaderData }) {
    const { downloads, user, error } = loaderData;

    // Show error state
    if (error) {
        return (
            <RootLayout cartItemCount={0} user={user}>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-text-primary mb-6">我的下载</h1>
                    <div className="p-4 bg-red-500/10 text-red-500 rounded-lg">
                        加载下载列表失败：{error.message}
                    </div>
                </div>
            </RootLayout>
        );
    }

    return (
        <RootLayout cartItemCount={0} user={user}>
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-text-primary">我的下载</h1>
                    <p className="text-text-secondary mt-2">
                        下载您购买的应用和文档
                    </p>
                </div>
                <DownloadsList downloads={downloads} />
            </div>
        </RootLayout>
    );
}
