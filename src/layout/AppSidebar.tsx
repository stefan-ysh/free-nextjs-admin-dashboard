"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Boxes as InventoryIcon,
  Building2 as OrgIcon,
  ChevronDown,
  LayoutGrid as DashboardIcon,
  LineChart as FinanceIcon,
  ShoppingCart as PurchaseIcon,
  CircleGauge as PerformanceIcon,
} from "lucide-react";

import type { PermissionName } from "@/hooks/usePermissions";

type NavSubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  requiredPermission?: PermissionName;
  requiredAnyPermissions?: PermissionName[];
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  requiredPermission?: PermissionName;
  requiredAnyPermissions?: PermissionName[];
  subItems?: NavSubItem[];
};

const navItems: NavItem[] = [
  {
    icon: <PerformanceIcon />,
    name: "首页",
    path: "/",
  },
  {
    icon: <DashboardIcon />,
    name: "我的待办",
    path: "/workflow/todo",
    requiredAnyPermissions: [
      "PURCHASE_CREATE",
      "PURCHASE_VIEW_ALL",
      "PURCHASE_APPROVE",
      "PURCHASE_REJECT",
      "INVENTORY_OPERATE_INBOUND",
      "INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY",
      "REIMBURSEMENT_APPROVE",
      "REIMBURSEMENT_PAY",
    ],
  },

  {
    icon: <FinanceIcon />,
    name: "财务中心",
    requiredAnyPermissions: ["FINANCE_VIEW_ALL", "REIMBURSEMENT_PAY", "REIMBURSEMENT_VIEW_ALL", "REIMBURSEMENT_CREATE"],
    subItems: [
      {
        name: "收支流水",
        path: "/finance",
        requiredPermission: "FINANCE_VIEW_ALL",
      },
      {
        name: "付款处理",
        path: "/finance/payments",
        requiredPermission: "REIMBURSEMENT_PAY",
      },
      {
        name: "报销申请",
        path: "/reimbursements",
        requiredAnyPermissions: [
          "REIMBURSEMENT_CREATE",
          "REIMBURSEMENT_VIEW_ALL",
          "REIMBURSEMENT_APPROVE",
          "REIMBURSEMENT_REJECT",
          "REIMBURSEMENT_PAY",
        ],
      },
    ],
  },

  {
    icon: <PurchaseIcon />,
    name: "采购中心",
    requiredAnyPermissions: [
      "PURCHASE_CREATE",
      "PURCHASE_VIEW_ALL",
      "PURCHASE_APPROVE",
      "PURCHASE_REJECT",
    ],
    subItems: [
      {
        name: "采购申请",
        path: "/purchases",
        requiredAnyPermissions: ["PURCHASE_CREATE", "PURCHASE_VIEW_ALL"],
      },
      {
        name: "审批处理",
        path: "/purchases/approvals",
        requiredAnyPermissions: ["PURCHASE_APPROVE", "PURCHASE_REJECT"],
      },
      {
        name: "进度监控",
        path: "/purchases/monitor",
        requiredPermission: "PURCHASE_MONITOR_VIEW",
      },
      {
        name: "审计记录",
        path: "/purchases/audit",
        requiredPermission: "PURCHASE_AUDIT_VIEW",
      },
    ],
  },

  {
    icon: <InventoryIcon />,
    name: "库存管理",
    subItems: [
      {
        name: "到货入库",
        path: "/inventory/inbound",
        requiredAnyPermissions: ["INVENTORY_OPERATE_INBOUND", "INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY"],
      },
      {
        name: "库存总览",
        path: "/inventory",
        requiredPermission: "INVENTORY_VIEW_DASHBOARD",
      },
      {
        name: "商品目录",
        path: "/inventory/items",
        requiredPermission: "INVENTORY_MANAGE_ITEMS",
      },
      {
        name: "库存流水",
        path: "/inventory/movements",
        requiredPermission: "INVENTORY_VIEW_ALL",
      },
    ],
  },
  {
    name: "人员管理",
    icon: <OrgIcon />,
    path: "/employees",
    requiredPermission: "USER_VIEW_ALL",
  },
  {
    name: "系统设置",
    icon: <OrgIcon />,
    subItems: [
      {
        name: "操作日志",
        path: "/audit/logs",
        requiredPermission: "USER_VIEW_ALL",
      },
    ],
  },

];


const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const [todoCount, setTodoCount] = useState(0);

  const filterNavItems = useCallback(
    (items: NavItem[]) =>
      items
        .map((item) => {
          if (
            item.requiredPermission &&
            !hasPermission(item.requiredPermission)
          ) {
            return null;
          }

          if (
            item.requiredAnyPermissions &&
            !item.requiredAnyPermissions.some((perm) => hasPermission(perm))
          ) {
            return null;
          }

          if (item.subItems) {
            const filteredSub = item.subItems.filter((subItem) => {
              if (
                subItem.requiredPermission &&
                !hasPermission(subItem.requiredPermission)
              ) {
                return false;
              }
              if (
                subItem.requiredAnyPermissions &&
                !subItem.requiredAnyPermissions.some((perm) => hasPermission(perm))
              ) {
                return false;
              }
              return true;
            });

            if (!filteredSub.length) {
              return null;
            }

            return { ...item, subItems: filteredSub };
          }

          return item;
        })
        .filter((item): item is NavItem => Boolean(item)),
    [hasPermission]
  );

  const filteredNavItems = useMemo(
    () => filterNavItems(navItems),
    [filterNavItems]
  );

  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>({});
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const showLabels = isExpanded || isHovered || isMobileOpen;
  const navAlignment = showLabels ? 'justify-start px-3' : 'justify-center px-0';

  const navButtonStyles = (active: boolean) =>
    cn(
      'w-full gap-3 text-sm transition-colors',
      navAlignment,
      active
        ? 'bg-sidebar-primary/15 text-sidebar-primary'
        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
    );

  const navLinkClass = (active: boolean) =>
    cn(buttonVariants({ variant: 'ghost', size: 'sm' }), navButtonStyles(active));

  const subNavButtonClass = (active: boolean) =>
    cn(
      buttonVariants({ variant: 'ghost', size: 'sm' }),
      'w-full justify-between text-sm px-3',
      active
        ? 'bg-sidebar-primary/15 text-sidebar-primary'
        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
    );

  const isActive = useCallback(
    (path: string) => {
      if (path === "/") {
        return pathname === "/";
      }
      if (path === "/workflow/todo") {
        return pathname.startsWith("/workflow");
      }
      // Avoid sibling double-highlight, e.g. /finance and /finance/payments.
      if (path === "/finance" || path === "/inventory") {
        return pathname === path;
      }
      if (path === "/purchases") {
        return (
          pathname === "/purchases" ||
          pathname === "/purchases/new" ||
          /^\/purchases\/[^/]+\/edit$/.test(pathname)
        );
      }
      return pathname === path || pathname.startsWith(`${path}/`);
    },
    [pathname]
  );

  const refreshTodoCount = useCallback(async () => {
    if (permissionLoading) return;
    const canTodo = [
      "PURCHASE_CREATE",
      "PURCHASE_APPROVE",
      "PURCHASE_REJECT",
      "INVENTORY_OPERATE_INBOUND",
      "INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY",
      "REIMBURSEMENT_APPROVE",
      "REIMBURSEMENT_PAY",
    ].some((perm) =>
      hasPermission(perm as PermissionName)
    );
    if (!canTodo) {
      setTodoCount(0);
      return;
    }


  }, [hasPermission, permissionLoading]);

  useEffect(() => {
    void refreshTodoCount();
    const timer = window.setInterval(() => {
      void refreshTodoCount();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshTodoCount]);

  useEffect(() => {
    let matchedIndex: number | null = null;

    filteredNavItems.forEach((nav, index) => {
      if (nav.subItems?.some((subItem) => isActive(subItem.path))) {
        matchedIndex = index;
      }
    });

    setOpenSubmenuIndex(matchedIndex);
  }, [filteredNavItems, isActive, pathname]);

  useEffect(() => {
    if (openSubmenuIndex === null) {
      return;
    }

    const ref = subMenuRefs.current[openSubmenuIndex];
    if (ref) {
      setSubMenuHeight((prev) => ({
        ...prev,
        [openSubmenuIndex]: ref.scrollHeight || 0,
      }));
    }
  }, [openSubmenuIndex]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenuIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="mt-3 flex flex-col gap-3">
      {items.map((nav, index) => {
        const isOpen = openSubmenuIndex === index;
        const isActiveRoot = nav.path ? isActive(nav.path) : false;
        const hasActiveSubItem = Boolean(nav.subItems?.some((subItem) => isActive(subItem.path)));
        const isParentActive = isActiveRoot || hasActiveSubItem;
        return (
          <li key={nav.name} className="space-y-1">
            {nav.subItems ? (
              <Button
                onClick={() => handleSubmenuToggle(index)}
                variant="ghost"
                size="sm"
                className={navButtonStyles(isParentActive)}
              >
                <span className={cn('text-lg', isParentActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70')}>
                  {nav.icon}
                </span>
                {showLabels && <span className="text-sm font-medium">{nav.name}</span>}
                {showLabels && nav.name === "我的待办" && todoCount > 0 && (
                  <span className="ml-auto rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                    {todoCount}
                  </span>
                )}
                {showLabels && (
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-sidebar-foreground/70 transition-transform',
                      isParentActive && 'text-sidebar-primary',
                      isOpen && 'rotate-180'
                    )}
                  />
                )}
              </Button>
            ) : (
              nav.path && (
                <Link
                  href={nav.path}
                  className={cn(navLinkClass(isActiveRoot), 'no-underline')}
                >
                  <span className={cn('text-lg', isActiveRoot ? 'text-sidebar-primary' : 'text-sidebar-foreground/70')}>
                    {nav.icon}
                  </span>
                  {showLabels && <span className="text-sm font-medium">{nav.name}</span>}
                  {showLabels && nav.path === "/workflow/todo" && todoCount > 0 && (
                    <span className="ml-auto rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      {todoCount}
                    </span>
                  )}
                </Link>
              )
            )}
            {nav.subItems && showLabels && (
              <div
                ref={(el) => {
                  subMenuRefs.current[index] = el;
                }}
                className="overflow-hidden transition-all duration-300"
                style={{
                  height:
                    openSubmenuIndex === index ? `${subMenuHeight[index] ?? 0}px` : '0px',
                }}
              >
                <ul className="mt-1 space-y-1 pl-6">
                  {nav.subItems.map((subItem) => (
                    <li key={subItem.name}>
                      <Link
                        href={subItem.path}
                        className={cn(subNavButtonClass(isActive(subItem.path)), 'no-underline')}
                      >
                        <span>{subItem.name}</span>
                        <span className="flex items-center gap-1">
                          {subItem.path === "/workflow/todo" && todoCount > 0 && (
                            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                              {todoCount}
                            </span>
                          )}
                          {subItem.new && <span className="text-xs uppercase text-sidebar-primary">new</span>}
                          {subItem.pro && <span className="text-xs uppercase text-sidebar-primary">pro</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300',
        'mt-16 px-5 lg:mt-0',
        isExpanded || isMobileOpen || isHovered ? 'w-[260px]' : 'w-[72px]',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        <ScrollArea className="flex-1 pb-8">
          <nav className="mb-6 pr-2">
            <div className="flex flex-col gap-4">
              <div>
                {renderMenuItems(filteredNavItems)}
              </div>
            </div>
          </nav>
        </ScrollArea>
      </div>
    </aside>
  );
};

export default AppSidebar;
