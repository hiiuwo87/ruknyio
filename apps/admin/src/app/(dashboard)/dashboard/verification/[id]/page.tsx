"use client";

/**
 * 📝 Verification Request Detail Page
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

import {
  VerificationDetail,
  VerificationDetailSkeleton,
} from "@/components/verification";

export default function VerificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRequest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>(`admin/verification/${id}`);
      setRequest(res.data);
    } catch {
      toast.error("Failed to load verification request");
      router.push("/dashboard/verification");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const handleApprove = async (adminNotes?: string) => {
    if (!confirm("Approve this verification request?")) return;
    try {
      await api.patch(`admin/verification/${id}`, {
        action: "approve",
        adminNotes,
      });
      toast.success("Verification request approved");
      fetchRequest();
    } catch {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (rejectionReason: string, adminNotes?: string) => {
    try {
      await api.patch(`admin/verification/${id}`, {
        action: "reject",
        rejectionReason,
        adminNotes,
      });
      toast.success("Verification request rejected");
      fetchRequest();
    } catch {
      toast.error("Failed to reject request");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5 pb-6">
            {loading ? (
              <VerificationDetailSkeleton />
            ) : request ? (
              <VerificationDetail
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
