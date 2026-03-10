"use client";

/**
 * 📋 Users Table
 * Paginated user list for admin dashboard
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  MoreHorizontal,
  Eye,
  Trash2,
  Crown,
  ShieldCheck,
  Mail,
  CheckCircle,
  XCircle,
  ShoppingCart,
  FileText,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserRoleBadge } from "./user-role-badge";

interface UserItem {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  phoneNumber?: string;
  lastLoginAt: string | null;
  createdAt: string;
  accountType: string;
  hasGoogle: boolean;
  name: string | null;
  username: string | null;
  avatar: string | null;
  eventsCount: number;
  formsCount: number;
  ordersCount: number;
  sessionsCount: number;
  postsCount: number;
}

interface UsersTableProps {
  users: UserItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string, email: string) => void;
  onRoleChange: (id: string, role: string) => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
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

export function UsersTable({
  users,
  total,
  page,
  totalPages,
  onPageChange,
  onDelete,
  onRoleChange,
}: UsersTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">All Users</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border/50 text-muted-foreground font-medium">
            {total}
          </span>
        </div>
        {totalPages > 1 && (
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      {/* User List */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No users found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user, index) => (
            <UserRow
              key={user.id}
              user={user}
              index={index}
              onDelete={onDelete}
              onRoleChange={onRoleChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/10">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = page <= 3 ? i + 1 : page - 2 + i;
              if (pageNum > totalPages || pageNum < 1) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-medium transition-colors",
                    pageNum === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-card text-muted-foreground",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Single User Row ─────────────────────────────────

function UserRow({
  user,
  index,
  onDelete,
  onRoleChange,
}: {
  user: UserItem;
  index: number;
  onDelete: (id: string, email: string) => void;
  onRoleChange: (id: string, role: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = user.name || user.email.split("@")[0];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted/50 transition-colors group"
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 shrink-0 text-sm font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/users/${user.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
          >
            {displayName}
          </Link>
          {user.emailVerified && (
            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
          )}
          <UserRoleBadge role={user.role} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
            <Mail className="h-2.5 w-2.5" />
            {user.email}
          </span>
          {user.username && (
            <span className="text-[10px] text-muted-foreground">
              @{user.username}
            </span>
          )}
          {user.twoFactorEnabled && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
              <ShieldCheck className="h-2.5 w-2.5" />
              2FA
            </span>
          )}
          {user.ordersCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ShoppingCart className="h-2.5 w-2.5" />
              {user.ordersCount}
            </span>
          )}
          {user.postsCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <FileText className="h-2.5 w-2.5" />
              {user.postsCount}
            </span>
          )}
        </div>
      </div>

      {/* Last Login */}
      <div className="hidden sm:block text-right">
        <span className="text-xs text-muted-foreground">
          {timeAgo(user.lastLoginAt)}
        </span>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Joined {timeAgo(user.createdAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-1.5 shadow-lg">
            <Link
              href={`/dashboard/users/${user.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Profile
            </Link>

            {/* Role Changes */}
            {user.role !== "ADMIN" && (
              <button
                onClick={() => {
                  onRoleChange(user.id, "ADMIN");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 transition-colors"
              >
                <Crown className="h-3.5 w-3.5" />
                Promote to Admin
              </button>
            )}
            {user.role !== "PREMIUM" && (
              <button
                onClick={() => {
                  onRoleChange(user.id, "PREMIUM");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-amber-600 hover:bg-amber-500/10 transition-colors"
              >
                <Crown className="h-3.5 w-3.5" />
                Set Premium
              </button>
            )}
            {user.role !== "BASIC" && user.role !== "GUEST" && (
              <button
                onClick={() => {
                  onRoleChange(user.id, "BASIC");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-500/10 transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                Set Basic
              </button>
            )}

            <div className="my-1 border-t border-border/10" />

            <button
              onClick={() => {
                onDelete(user.id, user.email);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete User
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6 space-y-2">
      <div className="h-6 w-32 bg-muted/60 rounded animate-pulse mb-4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card"
        >
          <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted/60 rounded animate-pulse" />
            <div className="h-3 w-52 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
