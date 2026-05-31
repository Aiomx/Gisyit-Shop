/**
 * Profile Card Component
 * 
 * Artistic profile display with user info and avatar
 */

import { User, Mail, Phone, Hash, Calendar, Edit2 } from "lucide-react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { UserProfile } from "~/lib/user";

interface ProfileCardProps {
    profile: UserProfile;
    onEdit?: () => void;
}

export function ProfileCard({ profile, onEdit }: ProfileCardProps) {
    const initials = profile.nickname
        ? profile.nickname.slice(0, 2).toUpperCase()
        : profile.email.slice(0, 2).toUpperCase();

    const memberSince = new Date(profile.created_at).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
    });

    return (
        <Card className="relative overflow-hidden">
            {/* Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent" />

            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    {/* Avatar */}
                    <div className="relative group">
                        {profile.avatar_url ? (
                            <img
                                src={profile.avatar_url}
                                alt={profile.nickname || "用户头像"}
                                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover ring-4 ring-white/10 shadow-xl"
                            />
                        ) : (
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center ring-4 ring-white/10 shadow-xl">
                                <span className="text-3xl md:text-4xl font-bold text-white">
                                    {initials}
                                </span>
                            </div>
                        )}
                        {/* Online indicator */}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-bg-secondary" />
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
                                {profile.nickname || "未设置昵称"}
                            </h2>
                            {onEdit && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onEdit}
                                    className="opacity-60 hover:opacity-100"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {profile.custom_id && (
                            <p className="text-text-secondary mb-4 flex items-center justify-center md:justify-start gap-2">
                                <Hash className="h-4 w-4" />
                                <span className="font-mono">@{profile.custom_id}</span>
                            </p>
                        )}

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                            <InfoItem
                                icon={Mail}
                                label="邮箱"
                                value={profile.email}
                                verified
                            />
                            <InfoItem
                                icon={Phone}
                                label="手机"
                                value={profile.phone || "未绑定"}
                                verified={!!profile.phone}
                            />
                            <InfoItem
                                icon={Calendar}
                                label="加入时间"
                                value={memberSince}
                            />
                            <InfoItem
                                icon={User}
                                label="会员等级"
                                value="普通会员"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}

interface InfoItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    verified?: boolean;
}

function InfoItem({ icon: Icon, label, value, verified }: InfoItemProps) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 backdrop-blur-sm">
            <div className="p-2 rounded-lg bg-accent/10">
                <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">{label}</p>
                <p className="text-sm text-text-primary truncate flex items-center gap-2">
                    {value}
                    {verified && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500/20">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}
