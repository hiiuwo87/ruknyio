"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Grid3X3,
  Menu,
  X,
  LayoutDashboard,
  Link2,
  ShoppingBag,
  FileText,
  CalendarDays,
  ListTodo,
  BarChart3,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/providers";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  className?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  isNew?: boolean;
  children?: NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Hook: useMediaQuery                                                */
/* ------------------------------------------------------------------ */

function useIsLargeScreen() {
  const [isLg, setIsLg] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsLg(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isLg;
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const collapseVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const isExpanded = useIsLargeScreen();

  // Hide sidebar in Settings page
  if (pathname?.startsWith('/app/settings')) {
    return null;
  }

  /* ---- Navigation items ------------------------------------------ */
  const navItems: NavItem[] = [
    { href: "/app", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/app/links", label: "روابطي", icon: Link2 },
    {
      href: "/app/store",
      label: "المتجر",
      icon: ShoppingBag,
      children: [
        { href: "/app/store", label: "نظرة عامة" },
        { href: "/app/store/products", label: "المنتجات" },
        { href: "/app/store/orders", label: "الطلبات" },
        { href: "/app/store/categories", label: "التصنيفات" },
      ],
    },
    {
      href: "/app/forms",
      label: "النماذج",
      icon: FileText,
      children: [
        { href: "/app/forms", label: "جميع النماذج" },
        { href: "/app/forms/create?new=true", label: "إنشاء نموذج" },
      ],
    },
    {
      href: "/app/events",
      label: "الأحداث",
      icon: CalendarDays,
      children: [
        { href: "/app/events", label: "جميع الأحداث" },
        { href: "/app/events/create", label: "إنشاء حدث" },
      ],
    },
  ];

  /* ---- Bottom items --------------------------------------------- */
  const bottomItems: NavItem[] = [
    { href: "/app/settings", label: "الإعدادات", icon: Settings },
  ];

  /* ---- Active detection ------------------------------------------ */
  const isItemActive = useCallback(
    (item: NavItem): boolean => {
      const itemPath = item.href.split("?")[0];
      if (itemPath === "/app") return pathname === "/app";
      if (pathname === itemPath) return true;
      return pathname.startsWith(itemPath + "/");
    },
    [pathname],
  );

  const isParentActive = useCallback(
    (item: NavItem): boolean => {
      if (!item.children) return false;
      return item.children.some((child) => isItemActive(child));
    },
    [isItemActive],
  );

  // Auto-expand active section on route change
  useEffect(() => {
    const activeParent = navItems.find(
      (item) => item.children && (isItemActive(item) || isParentActive(item)),
    );
    if (activeParent) setExpandedItem(activeParent.href);
  }, [pathname]);

  /* ---- Effects --------------------------------------------------- */
  // Close mobile on route change
  useEffect(() => setIsMobileOpen(false), [pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  /* ================================================================ */
  /*  Collapsed nav item (icon-only with tooltip / dropdown)          */
  /* ================================================================ */

  const CollapsedNavItem = ({ item }: { item: NavItem }) => {
    const hasChildren = !!item.children?.length;
    const active = isItemActive(item);
    const parentActive = isParentActive(item);

    if (hasChildren) {
      return (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl transition-colors",
                    parentActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {item.icon && <item.icon className="size-[18px]" />}
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              {item.label}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="left" align="start" sideOffset={8} className="min-w-[160px]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">{item.label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {item.children!.map((child) => {
              const childActive = isItemActive(child);
              return (
                <DropdownMenuItem key={child.href} asChild>
                  <Link
                    href={child.href}
                    className={cn(
                      "cursor-pointer",
                      childActive && "font-semibold text-primary",
                    )}
                  >
                    {child.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "relative flex size-10 items-center justify-center rounded-xl transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {item.icon && <item.icon className="size-[18px]" />}
            {item.isNew && (
              <span className="absolute top-1.5 left-1.5 size-2 rounded-full bg-primary" />
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  /* ================================================================ */
  /*  Sidebar content                                                  */
  /* ================================================================ */

  const sidebarContent = (
    <aside
      className={cn(
        "relative flex h-screen flex-col bg-background rounded-l-lg shrink-0 transition-[width] duration-300 ease-in-out",
        isExpanded ? "w-[240px]" : "w-[68px]",
        className,
      )}
      dir="rtl"
    >
      {/* Gradient divider */}
      <div className="via-border absolute left-0 top-12 bottom-0 w-px bg-gradient-to-b from-transparent to-transparent" />

      {/* ═══════ Brand header ═══════ */}
      <div className={cn(
        "flex items-center pt-4 pb-3 transition-all duration-300",
        isExpanded ? "gap-3 px-5" : "justify-center px-2",
      )}>
        <div className="relative size-10 shrink-0 overflow-hidden rounded-4xl bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/20 ring-1 ring-primary/10">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || ""}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center text-sm font-bold text-primary-foreground",
              user?.avatar && "hidden",
            )}
          >
            {(user?.name || "ر").charAt(0)}
          </span>
        </div>
        {isExpanded && (
          <div className="flex flex-col min-w-0 overflow-hidden">
            <span className="truncate text-[13px] font-semibold text-foreground leading-tight">
              {user?.name || "ركني"}
            </span>
            <span className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
              {user?.email || "لوحة التحكم"}
            </span>
          </div>
        )}
      </div>

      {/* ═══════ Navigation ═══════ */}
      <TooltipProvider delayDuration={0}>
        <nav className={cn(
          "flex-1 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-300",
          isExpanded ? "px-5" : "px-2",
        )}>
          {isExpanded && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">القائمة</p>
          )}

          <div className={cn(
            "w-full",
            isExpanded ? "space-y-0.5" : "flex flex-col items-center gap-1",
          )}>
            {/* ── Collapsed mode: icon-only ── */}
            {!isExpanded && navItems.map((item) => (
              <CollapsedNavItem key={item.href} item={item} />
            ))}

            {/* ── Expanded mode: full labels + collapsible children ── */}
            {isExpanded && navItems.map((item) => {
              const hasChildren = !!item.children?.length;
              const active = isItemActive(item);
              const parentActive = isParentActive(item);
              const isItemExpanded = expandedItem === item.href;

              if (hasChildren) {
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItem((v) => (v === item.href ? null : item.href))
                      }
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                        parentActive || isItemExpanded
                          ? "bg-primary/5 font-semibold text-foreground"
                          : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.icon && <item.icon className={cn("size-4", parentActive ? "text-primary" : "text-muted-foreground")} />}
                        <span>{item.label}</span>
                      </div>
                      <ChevronLeft
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          isItemExpanded ? "text-primary -rotate-90" : "text-muted-foreground/60",
                        )}
                        aria-hidden
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isItemExpanded && (
                        <motion.div
                          variants={collapseVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="overflow-hidden"
                        >
                          <div className="mr-3 border-r border-primary/20 space-y-0.5 py-1">
                            {item.children!.map((child) => {
                              const childActive = isItemActive(child);
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "flex items-center rounded-lg px-3 py-2 text-[12px] transition-colors",
                                    childActive
                                      ? "bg-primary/10 font-semibold text-primary"
                                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                                  )}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon && <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />}
                    <span>{item.label}</span>
                  </div>
                  {item.isNew && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* ═══════ Bottom navigation ═══════ */}
        <div className={cn(
          "pb-1 transition-all duration-300",
          isExpanded ? "px-5" : "px-2",
        )}>
          <div className="mb-2 h-px w-full bg-gradient-to-l from-transparent via-border to-transparent" />
          {bottomItems.map((item) => {
            const active = isItemActive(item);

            if (!isExpanded) {
              return (
                <div key={item.href} className="flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {item.icon && <item.icon className="size-[18px]" />}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                )}
              >
                {item.icon && <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* ═══════ Footer — تطبيقات أخرى ═══════ */}
        <div className={cn(
          "pb-4 transition-all duration-300",
          isExpanded ? "px-5" : "px-2",
        )}>
          <DropdownMenu>
            {!isExpanded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="mx-auto flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground outline-none cursor-pointer"
                    >
                      <Grid3X3 className="size-[18px]" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" sideOffset={8}>
                  تطبيقات أخرى
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground outline-none cursor-pointer"
                >
                  <Grid3X3 className="size-4" />
                  <span>تطبيقات أخرى</span>
                </button>
              </DropdownMenuTrigger>
            )}
            <DropdownMenuContent side={isExpanded ? "top" : "left"} align="start" className="w-52 p-3">
              <DropdownMenuLabel>التطبيقات</DropdownMenuLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { href: "/app/store", label: "المتجر", emoji: "🛍️" },
                  { href: "/app/forms", label: "النماذج", emoji: "📋" },
                  { href: "/app/events", label: "الأحداث", emoji: "📅" },
                  { href: "/app/tasks", label: "المهام", emoji: "✅" },
                  { href: "/app/analytics", label: "الإحصائيات", emoji: "📊" },
                  { href: "/app/settings", label: "الإعدادات", emoji: "⚙️" },
                ].map((app) => (
                  <Link
                    key={app.href}
                    href={app.href}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors",
                      pathname.startsWith(app.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/80 hover:bg-accent/50",
                    )}
                  >
                    <span className="text-xl leading-none">{app.emoji}</span>
                    <span className="text-[11px] font-medium leading-tight">{app.label}</span>
                  </Link>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TooltipProvider>
    </aside>
  );

  /* ================================================================ */
  /*  Mobile sidebar content (always expanded)                         */
  /* ================================================================ */

  const mobileSidebarContent = (
    <aside
      className={cn(
        "relative flex h-screen w-[240px] flex-col bg-background rounded-l-lg shrink-0",
        className,
      )}
      dir="rtl"
    >
      {/* Gradient divider */}
      <div className="via-border absolute left-0 top-12 bottom-0 w-px bg-gradient-to-b from-transparent to-transparent" />

      {/* Brand header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-4xl bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/20 ring-1 ring-primary/10">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || ""}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center text-sm font-bold text-primary-foreground",
              user?.avatar && "hidden",
            )}
          >
            {(user?.name || "ر").charAt(0)}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="truncate text-[13px] font-semibold text-foreground leading-tight">
            {user?.name || "ركني"}
          </span>
          <span className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
            {user?.email || "لوحة التحكم"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-5 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">القائمة</p>
        <div className="space-y-0.5 w-full">
          {navItems.map((item) => {
            const hasChildren = !!item.children?.length;
            const active = isItemActive(item);
            const parentActive = isParentActive(item);
            const isItemExpanded = expandedItem === item.href;

            if (hasChildren) {
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedItem((v) => (v === item.href ? null : item.href))
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                      parentActive || isItemExpanded
                        ? "bg-primary/5 font-semibold text-foreground"
                        : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon && <item.icon className={cn("size-4", parentActive ? "text-primary" : "text-muted-foreground")} />}
                      <span>{item.label}</span>
                    </div>
                    <ChevronLeft
                      className={cn(
                        "size-3.5 transition-transform duration-200",
                        isItemExpanded ? "text-primary -rotate-90" : "text-muted-foreground/60",
                      )}
                      aria-hidden
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isItemExpanded && (
                      <motion.div
                        variants={collapseVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="overflow-hidden"
                      >
                        <div className="mr-3 border-r border-primary/20 space-y-0.5 py-1">
                          {item.children!.map((child) => {
                            const childActive = isItemActive(child);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "flex items-center rounded-lg px-3 py-2 text-[12px] transition-colors",
                                  childActive
                                    ? "bg-primary/10 font-semibold text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
                )}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon && <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />}
                  <span>{item.label}</span>
                </div>
                {item.isNew && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom navigation */}
      <div className="px-5 pb-1">
        <div className="mb-2 h-px w-full bg-gradient-to-l from-transparent via-border to-transparent" />
        {bottomItems.map((item) => {
          const active = isItemActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-foreground/80 hover:bg-muted/50 hover:text-foreground active:bg-muted/70",
              )}
            >
              {item.icon && <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer — تطبيقات أخرى */}
      <div className="px-5 pb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground outline-none cursor-pointer"
            >
              <Grid3X3 className="size-4" />
              <span>تطبيقات أخرى</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] p-3">
            <DropdownMenuLabel>التطبيقات</DropdownMenuLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { href: "/app/store", label: "المتجر", emoji: "🛍️" },
                { href: "/app/forms", label: "النماذج", emoji: "📋" },
                { href: "/app/events", label: "الأحداث", emoji: "📅" },
                { href: "/app/tasks", label: "المهام", emoji: "✅" },
                { href: "/app/analytics", label: "الإحصائيات", emoji: "📊" },
                { href: "/app/settings", label: "الإعدادات", emoji: "⚙️" },
              ].map((app) => (
                <Link
                  key={app.href}
                  href={app.href}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors",
                    pathname.startsWith(app.href)
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground/80 hover:bg-accent/50",
                  )}
                >
                  <span className="text-xl leading-none">{app.emoji}</span>
                  <span className="text-[11px] font-medium leading-tight">{app.label}</span>
                </Link>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/30 shadow-sm md:hidden"
        aria-label="فتح القائمة"
      >
        <Menu className="size-5 text-foreground" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:block sticky top-0 h-screen">{sidebarContent}</div>

      {/* Mobile sidebar — overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              variants={overlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="fixed top-0 right-0 z-50 h-screen md:hidden"
            >
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
              {mobileSidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

export function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "relative hidden md:flex h-screen w-[68px] lg:w-[240px] flex-col bg-background shrink-0 animate-pulse transition-[width] duration-300",
        className,
      )}
      dir="rtl"
    >
      {/* Gradient divider */}
      <div className="via-border absolute left-0 top-12 bottom-0 w-px bg-gradient-to-b from-transparent to-transparent" />

      {/* Brand skeleton */}
      <div className="flex items-center gap-2.5 px-2 lg:px-5 pt-5 pb-3 justify-center lg:justify-start">
        <div className="size-10 rounded-2xl bg-muted shrink-0" />
        <div className="hidden lg:flex flex-col gap-1.5">
          <div className="h-3.5 w-20 rounded bg-muted" />
          <div className="h-2.5 w-16 rounded bg-muted" />
        </div>
      </div>

      {/* Nav skeleton */}
      <nav className="flex-1 px-2 lg:px-5 py-2 space-y-1">
        <div className="hidden lg:block h-2.5 w-10 rounded bg-muted mb-3 mx-3" />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-10 lg:h-9 rounded-xl lg:rounded-lg bg-muted mx-auto lg:mx-0 w-10 lg:w-full" />
        ))}
      </nav>

      {/* Bottom skeleton */}
      <div className="px-2 lg:px-5 pb-1">
        <div className="mb-2 h-px w-full bg-muted" />
        <div className="h-10 lg:h-9 rounded-xl lg:rounded-lg bg-muted mx-auto lg:mx-0 w-10 lg:w-full" />
      </div>

      {/* Footer skeleton */}
      <div className="px-2 lg:px-5 pb-4">
        <div className="h-10 lg:h-9 rounded-xl lg:rounded-lg bg-muted mx-auto lg:mx-0 w-10 lg:w-full" />
      </div>
    </aside>
  );
}
