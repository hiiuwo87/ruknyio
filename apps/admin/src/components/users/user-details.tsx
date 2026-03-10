"use client";

/**
 * 👤 User Details Component
 * Full user detail view for admin with sessions, security logs, and role management
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  ShieldOff,
  Crown,
  Users,
  Store,
  Calendar,
  Monitor,
  Globe,
  AlertTriangle,
  Trash2,
  LogOut,
  CheckCircle,
  XCircle,
  FileText,
  ShoppingCart,
  Heart,
  MessageSquare,
  UserCheck,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { UserRoleBadge } from "./user-role-badge";

interface UserDetailData {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  accountType: string;
  hasGoogle: boolean;
  hasLinkedin: boolean;
  hasTelegram: boolean;
  telegramUsername?: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    coverImage?: string;
    bio?: string;
    visibility: string;
    storageUsed: number;
    storageLimit: number;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    status: string;
  } | null;
  sessions: Array<{
    id: string;
    deviceName?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    ipAddress?: string;
    location?: string;
    lastActivity: string;
    createdAt: string;
  }>;
  securityLogs: Array<{
    id: string;
    action: string;
    status: string;
    description?: string;
    ipAddress?: string;
    browser?: string;
    os?: string;
    createdAt: string;
  }>;
  counts: {
    events: number;
    forms: number;
    orders: number;
    posts: number;
    sessions: number;
    followers: number;
    following: number;
    reviews: number;
    comments: number;
    files: number;
  };
}

interface UserDetailsProps {
  user: UserDetailData;
  onRoleChange: (role: string) => void;
  onRevokeSessions: () => void;
  onDelete: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const SECURITY_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS: { label: "Login", color: "text-emerald-500" },
  LOGIN_FAILED: { label: "Failed Login", color: "text-rose-500" },
  LOGOUT: { label: "Logout", color: "text-gray-500" },
  PASSWORD_CHANGE: { label: "Password Changed", color: "text-amber-500" },
  PROFILE_UPDATE: { label: "Profile Updated", color: "text-blue-500" },
  TWO_FA_ENABLED: { label: "2FA Enabled", color: "text-emerald-500" },
  TWO_FA_DISABLED: { label: "2FA Disabled", color: "text-rose-500" },
  TWO_FA_VERIFIED: { label: "2FA Verified", color: "text-emerald-500" },
  SESSION_DELETED: { label: "Session Deleted", color: "text-gray-500" },
  SESSION_DELETED_ALL: { label: "All Sessions Deleted", color: "text-amber-500" },
  EMAIL_CHANGE: { label: "Email Changed", color: "text-purple-500" },
  AVATAR_UPLOAD: { label: "Avatar Uploaded", color: "text-blue-500" },
  NEW_DEVICE_LOGIN: { label: "New Device", color: "text-amber-500" },
  SUSPICIOUS_ACTIVITY: { label: "Suspicious", color: "text-rose-500" },
  FAILED_LOGIN_THRESHOLD: { label: "Login Threshold", color: "text-rose-500" },
};

const ROLES = ["ADMIN", "PREMIUM", "BASIC", "GUEST"] as const;

export function UserDetails({
  user,
  onRoleChange,
  onRevokeSessions,
  onDelete,
}: UserDetailsProps) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/users"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {user.profile?.avatar ? (
            <img
              src={user.profile.avatar}
              alt={user.profile.name}
              className="h-12 w-12 rounded-full object-cover border-2 border-border/50"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-lg font-bold text-primary border-2 border-border/50">
              {(user.profile?.name || user.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {user.profile?.name || user.email.split("@")[0]}
              </h1>
              {user.emailVerified && (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
              <UserRoleBadge role={user.role} size="md" />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{user.email}</span>
              {user.profile?.username && (
                <span className="text-xs text-muted-foreground">
                  @{user.profile.username}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRoleDialog(!showRoleDialog)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 transition-all"
          >
            <Crown className="h-3.5 w-3.5" />
            Change Role
          </button>
          <button
            onClick={onRevokeSessions}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            Revoke Sessions
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </motion.div>

      {/* Role Change buttons (inline) */}
      {showRoleDialog && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30"
        >
          <span className="text-xs text-muted-foreground mr-2">Set role:</span>
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                onRoleChange(r);
                setShowRoleDialog(false);
              }}
              disabled={user.role === r}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                user.role === r
                  ? "bg-primary text-primary-foreground cursor-default"
                  : "bg-card hover:bg-muted/50 text-foreground border border-border/30",
              )}
            >
              {r}
            </button>
          ))}
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-3 sm:grid-cols-5 gap-3"
      >
        {[
          { icon: ShoppingCart, label: "Orders", value: user.counts.orders, color: "text-blue-500" },
          { icon: FileText, label: "Posts", value: user.counts.posts, color: "text-purple-500" },
          { icon: Activity, label: "Events", value: user.counts.events, color: "text-amber-500" },
          { icon: UserCheck, label: "Followers", value: user.counts.followers, color: "text-emerald-500" },
          { icon: MessageSquare, label: "Comments", value: user.counts.comments, color: "text-cyan-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-muted/30 p-3 sm:p-4 flex items-center gap-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Account Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-muted/30 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Account Details
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-foreground truncate">{user.email}</p>
              {user.emailVerified ? (
                <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-rose-500 shrink-0" />
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Phone</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-foreground">
                {user.phoneNumber || "—"}
              </p>
              {user.phoneNumber &&
                (user.phoneVerified ? (
                  <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-rose-500 shrink-0" />
                ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">2FA</p>
            <div className="flex items-center gap-1">
              {user.twoFactorEnabled ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-sm text-emerald-600 font-medium">
                    Enabled
                  </span>
                </>
              ) : (
                <>
                  <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Disabled</span>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Account Type</p>
            <p className="text-sm text-foreground">{user.accountType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Connected Accounts
            </p>
            <div className="flex items-center gap-2">
              {user.hasGoogle && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                  Google
                </span>
              )}
              {user.hasLinkedin && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-700/10 text-blue-700 font-medium">
                  LinkedIn
                </span>
              )}
              {user.hasTelegram && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 font-medium">
                  Telegram
                </span>
              )}
              {!user.hasGoogle && !user.hasLinkedin && !user.hasTelegram && (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Profile</p>
            <p className="text-sm text-foreground">
              {user.profileCompleted ? "Completed" : "Incomplete"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Last Login</p>
            <p className="text-sm text-foreground">
              {formatDate(user.lastLoginAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Joined</p>
            <p className="text-sm text-foreground">
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Profile Info */}
      {user.profile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Username</p>
              <p className="text-sm text-foreground">
                @{user.profile.username}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Visibility</p>
              <p className="text-sm text-foreground">{user.profile.visibility}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Storage Used</p>
              <p className="text-sm text-foreground">
                {formatBytes(user.profile.storageUsed)} /{" "}
                {formatBytes(user.profile.storageLimit)}
              </p>
            </div>
            {user.profile.bio && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-muted-foreground mb-1">Bio</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {user.profile.bio}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Store */}
      {user.store && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Store</h3>
          </div>
          <div className="flex items-center gap-3">
            {user.store.logo ? (
              <img
                src={user.store.logo}
                alt={user.store.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                <Store className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {user.store.name}
              </p>
              <p className="text-xs text-muted-foreground">
                /{user.store.slug} — {user.store.status}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Active Sessions */}
      {user.sessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Active Sessions ({user.sessions.length})
              </h3>
            </div>
          </div>
          <div className="space-y-2">
            {user.sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border/30"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {session.browser || "Unknown"} on {session.os || "Unknown"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {session.deviceType && (
                      <span className="text-[10px] text-muted-foreground">
                        {session.deviceType}
                      </span>
                    )}
                    {session.ipAddress && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Globe className="h-2.5 w-2.5" />
                        {session.ipAddress}
                      </span>
                    )}
                    {session.location && (
                      <span className="text-[10px] text-muted-foreground">
                        {session.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {timeAgo(session.lastActivity)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Security Logs */}
      {user.securityLogs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Security Logs ({user.securityLogs.length})
            </h3>
          </div>
          <div className="space-y-1.5">
            {user.securityLogs.map((log) => {
              const actionConfig = SECURITY_ACTION_LABELS[log.action] || {
                label: log.action,
                color: "text-muted-foreground",
              };

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border/30"
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                      log.status === "SUCCESS"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : log.status === "FAILED"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-amber-500/10 text-amber-500",
                    )}
                  >
                    {log.status === "SUCCESS" ? "✓" : log.status === "FAILED" ? "✗" : "!"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium", actionConfig.color)}>
                      {actionConfig.label}
                    </p>
                    {log.description && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {log.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">
                      {timeAgo(log.createdAt)}
                    </p>
                    {log.ipAddress && (
                      <p className="text-[10px] text-muted-foreground">
                        {log.ipAddress}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Activity Counts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl bg-muted/30 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Activity Summary
          </h3>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { label: "Orders", value: user.counts.orders },
            { label: "Posts", value: user.counts.posts },
            { label: "Events", value: user.counts.events },
            { label: "Forms", value: user.counts.forms },
            { label: "Followers", value: user.counts.followers },
            { label: "Following", value: user.counts.following },
            { label: "Reviews", value: user.counts.reviews },
            { label: "Comments", value: user.counts.comments },
            { label: "Files", value: user.counts.files },
            { label: "Sessions", value: user.counts.sessions },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl bg-card p-3 border border-border/30 text-center"
            >
              <p className="text-lg font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function UserDetailsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted/60" />
        <div className="h-12 w-12 rounded-full bg-muted/60" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted/60 rounded" />
          <div className="h-3 w-52 bg-muted/60 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted/30 p-4 h-16" />
        ))}
      </div>
      <div className="rounded-2xl bg-muted/30 p-5 h-48" />
      <div className="rounded-2xl bg-muted/30 p-5 h-32" />
    </div>
  );
}
