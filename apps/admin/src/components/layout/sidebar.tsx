"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Store,
  FileText,
  CalendarDays,
  Settings,
  Shield,
  ChevronDown,
  ChevronLeft,
  LogOut,
  HelpCircle,
  Activity,
  ShoppingBag,
  CreditCard,
  Receipt,
  TrendingUp,
  BarChart3,
  PieChart,
  Bell,
  Mail,
  MessageSquare,
  Send,
  Megaphone,
  Image,
  Video,
  FolderOpen,
  Upload,
  Globe,
  Link2,
  Palette,
  Code,
  Database,
  Server,
  Cpu,
  ScrollText,
  AlertTriangle,
  Bug,
  Key,
  UserCheck,
  UserX,
  Crown,
  Tag,
  Ticket,
  HelpingHand,
  BookOpen,
  Layers,
  FileCheck,
} from "lucide-react";
import { useAuth } from "@/providers";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  items: NavItem[];
}

// ─── Animations ──────────────────────────────────────

const collapseVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1 },
};

// ─── Nav Sections ────────────────────────────────────

const navSections: NavSection[] = [
  {
    id: "main",
    label: "Overview",
    icon: LayoutDashboard,
    iconBg: "bg-primary",
    iconColor: "text-white",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/analytics", label: "Analytics", icon: Activity },
      { href: "/dashboard/reports", label: "Reports", icon: PieChart },
    ],
  },
  {
    id: "users",
    label: "Users & Roles",
    icon: Users,
    iconBg: "bg-[#c8e972]",
    iconColor: "text-black",
    items: [
      { href: "/dashboard/users", label: "All Users", icon: Users },
      { href: "/dashboard/verification", label: "Verification", icon: FileCheck },
    ],
  },
  {
    id: "commerce",
    label: "Commerce",
    icon: Store,
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/stores", label: "Stores", icon: Store },
      { href: "/dashboard/stores/categories", label: "Store Categories", icon: FolderOpen },
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
      { href: "/dashboard/transactions", label: "Transactions", icon: CreditCard },
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/products", label: "Products", icon: Tag },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: FileText,
    iconBg: "bg-violet-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/forms", label: "Forms", icon: FileText },
      { href: "/dashboard/events", label: "Events", icon: CalendarDays },
      { href: "/dashboard/pages", label: "Pages", icon: BookOpen },
      { href: "/dashboard/media", label: "Media Library", icon: Image },
      { href: "/dashboard/wallpapers", label: "Form Wallpapers", icon: Image },
      { href: "/dashboard/uploads", label: "Uploads", icon: Upload },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    iconBg: "bg-amber-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Send },
      { href: "/dashboard/notifications", label: "Push Notifications", icon: Bell },
      { href: "/dashboard/emails", label: "Email Templates", icon: Mail },
      { href: "/dashboard/announcements", label: "Announcements", icon: Megaphone },
      { href: "/dashboard/coupons", label: "Coupons & Offers", icon: Ticket },
    ],
  },
  {
    id: "analytics",
    label: "Insights",
    icon: BarChart3,
    iconBg: "bg-sky-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/insights/traffic", label: "Traffic", icon: TrendingUp },
      { href: "/dashboard/insights/revenue", label: "Revenue", icon: BarChart3 },
      { href: "/dashboard/insights/engagement", label: "Engagement", icon: Activity },
      { href: "/dashboard/insights/growth", label: "Growth", icon: PieChart },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    iconBg: "bg-pink-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/themes", label: "Themes", icon: Palette },
      { href: "/dashboard/branding", label: "Branding", icon: Globe },
      { href: "/dashboard/links", label: "Links", icon: Link2 },
      { href: "/dashboard/layouts", label: "Layouts", icon: Layers },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: HelpingHand,
    iconBg: "bg-teal-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/tickets", label: "Support Tickets", icon: MessageSquare },
      { href: "/dashboard/feedback", label: "Feedback", icon: HelpCircle },
      { href: "/dashboard/knowledge-base", label: "Knowledge Base", icon: BookOpen },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Shield,
    iconBg: "bg-destructive",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/security", label: "Security", icon: Shield },
      { href: "/dashboard/logs", label: "Audit Logs", icon: ScrollText },
      { href: "/dashboard/errors", label: "Error Tracking", icon: Bug },
      { href: "/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
    ],
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code,
    iconBg: "bg-slate-700",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/api-keys", label: "API Keys", icon: Key },
      { href: "/dashboard/webhooks", label: "Webhooks", icon: Code },
      { href: "/dashboard/database", label: "Database", icon: Database },
      { href: "/dashboard/infrastructure", label: "Infrastructure", icon: Server },
      { href: "/dashboard/performance", label: "Performance", icon: Cpu },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    iconBg: "bg-gray-500",
    iconColor: "text-white",
    items: [
      { href: "/dashboard/settings", label: "General", icon: Settings },
      { href: "/dashboard/settings/integrations", label: "Integrations", icon: Layers },
      { href: "/dashboard/settings/billing", label: "Billing", icon: CreditCard },
    ],
  },
];

// ─── Sidebar Component ──────────────────────────────

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout: handleLogout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("main");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-expand the section that contains the current path
  useEffect(() => {
    for (const section of navSections) {
      if (section.items.some((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")))) {
        setExpandedSection(section.id);
        break;
      }
    }
  }, [pathname]);

  const toggleSection = (sectionId: string) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const isItemActive = (item: NavItem, section: NavSection): boolean => {
    if (item.href === "/dashboard") return pathname === "/dashboard";
    // Exact match always wins
    if (pathname === item.href) return true;
    // For startsWith, only match if no other sibling in the same section is a better (more specific) match
    if (pathname.startsWith(item.href + "/")) {
      const hasBetterMatch = section.items.some(
        (sibling) =>
          sibling.href !== item.href &&
          (pathname === sibling.href || pathname.startsWith(sibling.href + "/")),
      );
      return !hasBetterMatch;
    }
    return false;
  };

  const initials = mounted
    ? (user?.name
        ?.split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || user?.email?.[0]?.toUpperCase() || "A")
    : "A";

  const doLogout = async () => {
    setIsProfileOpen(false);
    await handleLogout();
    router.replace("/login");
  };

  return (
    <aside
      className={cn(
        "flex h-[calc(100svh-theme(spacing.4))] w-[230px] flex-col rounded-2xl border border-border/50 bg-card m-2",
        className,
      )}
    >
      {/* ── Profile Header ── */}
      <div className="relative p-3" ref={profileRef}>
        <button
          type="button"
          onClick={() => setIsProfileOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-foreground">
              {mounted ? (user?.name ?? "Admin") : "Admin"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {mounted ? (user?.email ?? "") : ""}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
              isProfileOpen && "rotate-180",
            )}
          />
        </button>

        {/* Profile Dropdown */}
        {isProfileOpen && (
          <div className="absolute left-2 right-2 top-full z-50 mt-1.5 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-2">
            <div className="space-y-0.5">
              <Link
                href="/dashboard/settings"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-foreground transition-colors hover:bg-muted/50"
              >
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Settings className="size-3.5 text-primary" />
                </div>
                <span>Settings</span>
              </Link>
            </div>
            <div className="h-px bg-border/50 mx-1 my-1.5" />
            <button
              type="button"
              onClick={doLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-destructive transition-colors hover:bg-destructive/10"
            >
              <div className="w-6 h-6 rounded-md bg-destructive/10 flex items-center justify-center">
                <LogOut className="size-3.5" />
              </div>
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navSections.map((section) => {
          const isExpanded = expandedSection === section.id;
          const SectionIcon = section.icon;

          return (
            <div key={section.id} className="rounded-xl overflow-hidden">
              {/* Section Header */}
              <motion.button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 overflow-hidden rounded-lg p-2 text-left outline-none ring-primary/50 transition-all h-8 text-xs",
                  "focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
                  "[&>span:last-child]:truncate [&>svg]:size-3.5 [&>svg]:shrink-0",
                  isExpanded
                    ? "bg-muted/60 text-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 flex-1">
                  <motion.div
                    animate={{ rotate: isExpanded ? -90 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <ChevronLeft className="size-3 text-muted-foreground/70" />
                  </motion.div>
                  <div className={cn("w-5.5 h-5.5 rounded-md flex items-center justify-center", section.iconBg)}>
                    <SectionIcon className={cn("size-3", section.iconColor)} />
                  </div>
                  <span className="text-xs">{section.label}</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/80 text-muted-foreground font-medium">
                  {section.items.length}
                </span>
              </motion.button>

              {/* Section Items */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    variants={collapseVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="overflow-hidden"
                  >
                    <div className="py-1 pl-4 space-y-0.5">
                      {section.items.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = isItemActive(item, section);

                        return (
                          <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <Link
                              href={item.href}
                              className={cn(
                                "flex w-full items-center gap-2 overflow-hidden rounded-lg px-2 py-1 text-left outline-none ring-primary/50 transition-all h-7 text-xs",
                                "focus-visible:ring-2 [&>span:last-child]:truncate [&>svg]:size-3.5 [&>svg]:shrink-0",
                                isActive
                                  ? "bg-primary text-primary-foreground font-medium"
                                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {Icon && <Icon className="size-3.5 shrink-0" />}
                              <span className="truncate flex-1">{item.label}</span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

    </aside>
  );
}

// ─── Skeleton ────────────────────────────────────────

export function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex h-[calc(100svh-theme(spacing.4))] w-[230px] flex-col rounded-2xl border border-border/50 bg-card m-2 animate-pulse",
        className,
      )}
    >
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-muted" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-2.5 w-28 rounded bg-muted mt-1" />
          </div>
          <div className="size-3.5 rounded bg-muted" />
        </div>
      </div>
      <nav className="flex-1 space-y-1.5 px-2 py-1.5">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="h-8 rounded-lg bg-muted" />
        ))}
      </nav>
    </aside>
  );
}
