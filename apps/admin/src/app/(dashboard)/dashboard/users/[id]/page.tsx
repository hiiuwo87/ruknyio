"use client";

/**
 * 👤 User Detail Page
 * Admin view for a single user with full profile, sessions, security logs, and management actions
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

import { UserDetails, UserDetailsSkeleton } from "@/components/users";

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>(`admin/users/${userId}`);
      setUser(res.data);
    } catch {
      toast.error("Failed to load user details");
      router.push("/dashboard/users");
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleRoleChange = async (role: string) => {
    if (
      !confirm(`Are you sure you want to change this user's role to ${role}?`)
    )
      return;
    try {
      await api.patch(`admin/users/${userId}/role`, { role });
      toast.success(`User role updated to ${role}`);
      await fetchUser();
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleRevokeSessions = async () => {
    if (
      !confirm(
        "Are you sure you want to revoke all sessions for this user? They will be logged out everywhere.",
      )
    )
      return;
    try {
      await api.delete(`admin/users/${userId}/sessions`);
      toast.success("All sessions revoked");
      await fetchUser();
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    )
      return;
    try {
      await api.delete(`admin/users/${userId}`);
      toast.success("User deleted");
      router.push("/dashboard/users");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 pb-6">
            {loading ? (
              <UserDetailsSkeleton />
            ) : user ? (
              <UserDetails
                user={user}
                onRoleChange={handleRoleChange}
                onRevokeSessions={handleRevokeSessions}
                onDelete={handleDelete}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
