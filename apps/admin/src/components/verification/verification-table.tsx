"use client";

/**
 * 📋 Verification Requests Table
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  FileCheck,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Building2,
  User,
  Image,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { VerificationStatusBadge } from "./verification-status-badge";

interface VerificationItem {
  id: string;
  type: string;
  status: string;
  fullName: string;
  businessName: string | null;
  screenshotsCount: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    isVerified: boolean;
    name: string | null;
    username: string | null;
    avatar: string | null;
  };
}

interface VerificationTableProps {
  requests: VerificationItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
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

export function VerificationTable({
  requests,
  total,
  page,
  totalPages,
  onPageChange,
  onApprove,
  onReject,
}: VerificationTableProps) {
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
          <h3 className="text-base font-bold text-foreground">Verification Requests</h3>
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

      {/* Request List */}
      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileCheck className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No verification requests</p>
          <p className="text-xs mt-1">Requests will appear here when users submit them</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((req, index) => (
            <RequestRow
              key={req.id}
              request={req}
              index={index}
              onApprove={onApprove}
              onReject={onReject}
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

// ─── Single Request Row ──────────────────────────────

function RequestRow({
  request,
  index,
  onApprove,
  onReject,
}: {
  request: VerificationItem;
  index: number;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
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

  const displayName = request.user.name || request.user.email.split("@")[0];
  const isPending = request.status === "PENDING" || request.status === "UNDER_REVIEW";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted/50 transition-colors group"
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {request.user.avatar ? (
          <img
            src={request.user.avatar}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 text-sm font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Request Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/verification/${request.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
          >
            {request.fullName}
          </Link>
          <VerificationStatusBadge status={request.status} />
          {request.type === "BUSINESS" ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 font-medium">
              <Building2 className="h-2.5 w-2.5" />
              Business
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
              <User className="h-2.5 w-2.5" />
              Personal
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-muted-foreground truncate">
            {request.user.email}
          </span>
          {request.businessName && (
            <span className="text-[10px] text-muted-foreground">
              {request.businessName}
            </span>
          )}
          {request.screenshotsCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Image className="h-2.5 w-2.5" />
              {request.screenshotsCount} screenshots
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="hidden sm:block text-right">
        <span className="text-xs text-muted-foreground">
          {timeAgo(request.createdAt)}
        </span>
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
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-1.5 shadow-lg">
            <Link
              href={`/dashboard/verification/${request.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Link>

            {isPending && (
              <>
                <button
                  onClick={() => {
                    onApprove(request.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => {
                    onReject(request.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function VerificationTableSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6 space-y-2">
      <div className="h-6 w-48 bg-muted/60 rounded animate-pulse mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card"
        >
          <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 bg-muted/60 rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
