"use client";

/**
 * 📝 Verification Request Detail
 * Full detail view for reviewing a verification request
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  User,
  Building2,
  Mail,
  Globe,
  Image,
  FileText,
  Store,
  Shield,
  Clock,
  ExternalLink,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { VerificationStatusBadge } from "./verification-status-badge";

interface VerificationDetailData {
  id: string;
  type: string;
  status: string;
  fullName: string;
  socialLinks: Array<{ platform: string; url: string }> | null;
  screenshots: string[];
  businessName: string | null;
  businessEmail: string | null;
  notes: string | null;
  adminNotes: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    isVerified: boolean;
    emailVerified: boolean;
    profileCompleted: boolean;
    twoFactorEnabled: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    name: string | null;
    username: string | null;
    avatar: string | null;
    bio: string | null;
    store: {
      id: string;
      name: string;
      slug: string;
      status: string;
    } | null;
  };
}

interface VerificationDetailProps {
  request: VerificationDetailData;
  onApprove: (adminNotes?: string) => void;
  onReject: (rejectionReason: string, adminNotes?: string) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "text-pink-500 bg-pink-500/10",
  twitter: "text-sky-500 bg-sky-500/10",
  x: "text-foreground bg-muted/50",
  facebook: "text-blue-600 bg-blue-600/10",
  linkedin: "text-blue-700 bg-blue-700/10",
  youtube: "text-red-500 bg-red-500/10",
  tiktok: "text-foreground bg-muted/50",
  snapchat: "text-yellow-500 bg-yellow-500/10",
  telegram: "text-cyan-500 bg-cyan-500/10",
  whatsapp: "text-emerald-500 bg-emerald-500/10",
};

export function VerificationDetail({
  request,
  onApprove,
  onReject,
}: VerificationDetailProps) {
  const [adminNotes, setAdminNotes] = useState(request.adminNotes || "");
  const [rejectionReason, setRejectionReason] = useState(request.rejectionReason || "");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isPending = request.status === "PENDING" || request.status === "UNDER_REVIEW";

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
            href="/dashboard/verification"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {request.user.avatar ? (
            <img
              src={request.user.avatar}
              alt={request.fullName}
              className="h-12 w-12 rounded-full object-cover border-2 border-border/50"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-lg font-bold text-primary border-2 border-border/50">
              {request.fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">{request.fullName}</h1>
              <VerificationStatusBadge status={request.status} size="md" />
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
            <p className="text-xs text-muted-foreground mt-0.5">
              {request.user.email} · Submitted {formatDate(request.createdAt)}
            </p>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove(adminNotes || undefined)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-all"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={() => setShowRejectForm(!showRejectForm)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        )}
      </motion.div>

      {/* Reject Form */}
      {showRejectForm && isPending && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-rose-600">Rejection Reason</p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain why this request is being rejected..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-card border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-rose-500/30 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (rejectionReason.trim()) {
                  onReject(rejectionReason, adminNotes || undefined);
                }
              }}
              disabled={!rejectionReason.trim()}
              className="h-8 px-4 rounded-xl text-xs font-medium bg-rose-500 hover:bg-rose-600 text-white transition-all disabled:opacity-40"
            >
              Confirm Rejection
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="h-8 px-4 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-muted/30 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">User Information</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <div className="flex items-center gap-1">
              <p className="text-sm text-foreground truncate">{request.user.email}</p>
              {request.user.emailVerified && <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Username</p>
            <p className="text-sm text-foreground">
              {request.user.username ? `@${request.user.username}` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Role</p>
            <p className="text-sm text-foreground">{request.user.role}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Joined</p>
            <p className="text-sm text-foreground">{formatDate(request.user.createdAt)}</p>
          </div>
          {request.user.bio && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-muted-foreground mb-1">Bio</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{request.user.bio}</p>
            </div>
          )}
        </div>
        {request.user.store && (
          <div className="mt-4 pt-3 border-t border-border/20">
            <div className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Store:</span>
              <span className="text-sm font-medium text-foreground">{request.user.store.name}</span>
              <span className="text-[10px] text-muted-foreground">/{request.user.store.slug}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-medium",
                request.user.store.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-gray-500/10 text-gray-500",
              )}>
                {request.user.store.status}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Business Info */}
      {request.type === "BUSINESS" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Business Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Business Name</p>
              <p className="text-sm text-foreground">{request.businessName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Business Email</p>
              <p className="text-sm text-foreground">{request.businessEmail || "—"}</p>
            </div>
          </div>
          {request.businessEmail && (
            <p className="text-xs text-muted-foreground mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <Mail className="h-3 w-3 inline mr-1" />
              For Iraqi business verification, the user should also send an email to{" "}
              <span className="font-medium text-amber-600">support@rukny.io</span>
            </p>
          )}
        </motion.div>
      )}

      {/* Social Links */}
      {request.socialLinks && Array.isArray(request.socialLinks) && request.socialLinks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Social Media Links ({request.socialLinks.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {request.socialLinks.map((link: any, i: number) => {
              const platform = (link.platform || "").toLowerCase();
              const colorClasses = PLATFORM_COLORS[platform] || "text-muted-foreground bg-muted/50";
              return (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/30 hover:bg-muted/50 transition-colors"
                >
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase", colorClasses)}>
                    {link.platform}
                  </span>
                  <span className="text-xs text-foreground truncate flex-1">{link.url}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Screenshots */}
      {request.screenshots.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Image className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Screenshots ({request.screenshots.length})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {request.screenshots.map((src, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(src)}
                className="relative aspect-video rounded-xl overflow-hidden bg-card border border-border/30 hover:border-primary/30 transition-colors group"
              >
                <img
                  src={src}
                  alt={`Screenshot ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                  <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Screenshot"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* User Notes */}
      {request.notes && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">User Notes</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{request.notes}</p>
        </motion.div>
      )}

      {/* Admin Notes */}
      {isPending && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Admin Notes</h3>
          </div>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add internal notes about this request..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-card border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
          />
        </motion.div>
      )}

      {/* Previous Rejection Reason */}
      {request.rejectionReason && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-rose-600">Rejection Reason</h3>
          </div>
          <p className="text-sm text-muted-foreground">{request.rejectionReason}</p>
          {request.reviewedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              <Clock className="h-2.5 w-2.5 inline mr-0.5" />
              Reviewed {formatDate(request.reviewedAt)}
            </p>
          )}
        </motion.div>
      )}

      {/* Approval Info */}
      {request.status === "APPROVED" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-emerald-600">Approved</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            This verification request has been approved.
          </p>
          {request.reviewedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              <Clock className="h-2.5 w-2.5 inline mr-0.5" />
              Approved {formatDate(request.reviewedAt)}
            </p>
          )}
          {request.adminNotes && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-emerald-500/10">
              Notes: {request.adminNotes}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

export function VerificationDetailSkeleton() {
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
      <div className="rounded-2xl bg-muted/30 p-5 h-40" />
      <div className="rounded-2xl bg-muted/30 p-5 h-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-video rounded-xl bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
