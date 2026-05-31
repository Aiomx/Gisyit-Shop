/**
 * Account Profile Route
 * 
 * User profile page with artistic design
 */

import { useState } from "react";
import { Form, redirect } from "react-router";
import type { Route } from "./+types/account.profile";
import { RootLayout } from "~/components/layout";
import { ProfileCard, OrderStatsCard, RecentOrdersCard } from "~/components/account";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { X } from "lucide-react";
import type { UserProfile } from "~/lib/user";
import { getUserOrders } from "~/lib/order";

export function meta() {
    return [
        { title: "个人资料 - Gisyit Shop" },
        { name: "description", content: "管理您的个人资料" },
    ];
}

export async function loader({ request }: Route.LoaderArgs) {
    const { requireUserSession, getUserForHeader, getUserIdFromSession } = await import("~/lib/auth/auth.server");
    const { getUserProfileData } = await import("~/lib/user/profile.server");

    // Require authentication
    await requireUserSession(request);

    // Get user info for header
    const user = await getUserForHeader(request);

    // Get user ID
    const userId = await getUserIdFromSession(request);

    if (!userId) {
        return redirect("/auth/login?redirect=/account/profile");
    }

    // Fetch user orders
    const ordersResult = await getUserOrders(userId);
    const orders = ordersResult.success ? ordersResult.orders || [] : [];

    // Get profile data
    const email = user.isLoggedIn ? user.email : "";
    const profileData = await getUserProfileData(userId, email, orders);

    return {
        profileData,
        user,
    };
}

export async function action({ request }: Route.ActionArgs) {
    const { requireUserSession, getUserIdFromSession } = await import("~/lib/auth/auth.server");
    const { updateUserProfile } = await import("~/lib/user/profile.server");

    // Require authentication
    await requireUserSession(request);

    const userId = await getUserIdFromSession(request);
    if (!userId) {
        return { success: false, error: "未登录" };
    }

    const formData = await request.formData();
    const nickname = formData.get("nickname") as string;
    const custom_id = formData.get("custom_id") as string;
    const phone = formData.get("phone") as string;

    const result = await updateUserProfile(userId, {
        nickname: nickname || undefined,
        custom_id: custom_id || undefined,
        phone: phone || undefined,
    });

    if (!result.success) {
        return { success: false, error: result.error?.message };
    }

    return { success: true };
}

export default function AccountProfile({ loaderData, actionData }: Route.ComponentProps) {
    const { profileData, user } = loaderData;
    const [isEditing, setIsEditing] = useState(false);

    return (
        <RootLayout cartItemCount={0} user={user}>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-text-primary">个人资料</h1>
                    <p className="text-text-secondary mt-2">管理您的账户信息和订单</p>
                </div>

                {/* Profile Card */}
                <ProfileCard
                    profile={profileData.profile}
                    onEdit={() => setIsEditing(true)}
                />

                {/* Order Stats */}
                <OrderStatsCard stats={profileData.orderStats} />

                {/* Recent Orders */}
                <RecentOrdersCard orders={profileData.recentOrders} />

                {/* Edit Profile Modal */}
                {isEditing && (
                    <EditProfileModal
                        profile={profileData.profile}
                        onClose={() => setIsEditing(false)}
                        actionData={actionData}
                    />
                )}
            </div>
        </RootLayout>
    );
}

/**
 * Edit Profile Modal Component
 */
function EditProfileModal({
    profile,
    onClose,
    actionData,
}: {
    profile: UserProfile;
    onClose: () => void;
    actionData?: { success?: boolean; error?: string };
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <Card className="relative z-10 w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-text-primary">
                        编辑资料
                    </h2>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {actionData?.error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
                        {actionData.error}
                    </div>
                )}

                {actionData?.success && (
                    <div className="mb-4 p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
                        资料更新成功
                    </div>
                )}

                <Form method="post" className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="nickname">昵称</Label>
                        <Input
                            id="nickname"
                            name="nickname"
                            defaultValue={profile.nickname || ""}
                            placeholder="设置您的昵称"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="custom_id">自定义ID</Label>
                        <Input
                            id="custom_id"
                            name="custom_id"
                            defaultValue={profile.custom_id || ""}
                            placeholder="4-20位字母、数字或下划线"
                        />
                        <p className="text-xs text-text-muted">
                            用于展示的唯一标识，如 @your_id
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">手机</Label>
                        <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            defaultValue={profile.phone || ""}
                            placeholder="绑定手机号码"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>邮箱</Label>
                        <Input
                            value={profile.email}
                            disabled
                            className="bg-white/5"
                        />
                        <p className="text-xs text-text-muted">
                            邮箱不可修改
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                        >
                            取消
                        </Button>
                        <Button type="submit" className="flex-1">
                            保存
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
}
