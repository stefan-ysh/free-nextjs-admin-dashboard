"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    name: "仪表盘",
    path: "/",
  },

  {
    icon: <FinanceIcon />,
    name: "财务管理",
    requiredAnyPermissions: ["FINANCE_VIEW_ALL", "PURCHASE_PAY"],
    subItems: [
      {
        name: "财务流水",
        path: "/finance",
        requiredPermission: "FINANCE_VIEW_ALL",
      },
      {
        name: "付款任务",
        path: "/finance/payments",
        requiredPermission: "PURCHASE_PAY",
        // new: true,
      },
    ],
  },

  {
    icon: <PurchaseIcon />,
    name: "采购管理",
    requiredAnyPermissions: [
      "PURCHASE_CREATE",
      "PURCHASE_VIEW_ALL",
      "PURCHASE_VIEW_DEPARTMENT",
      "PURCHASE_APPROVE",
      "PURCHASE_REJECT",
      "PURCHASE_PAY",
    ],
    subItems: [
      {
        name: "采购台账",
        path: "/purchases",
        requiredAnyPermissions: ["PURCHASE_CREATE", "PURCHASE_VIEW_ALL", "PURCHASE_VIEW_DEPARTMENT"],
      },
      {
        name: "采购审批",
        path: "/purchases/approvals",
        requiredAnyPermissions: ["PURCHASE_APPROVE", "PURCHASE_REJECT", "PURCHASE_PAY"],
        // new: true,
      },
      {
        name: "流程监控",
        path: "/purchases/monitor",
        requiredAnyPermissions: ["PURCHASE_VIEW_ALL", "PURCHASE_APPROVE", "PURCHASE_REJECT", "PURCHASE_PAY"],
      },
      {
        name: "审计日志",
        path: "/purchases/audit",
        requiredAnyPermissions: ["PURCHASE_VIEW_ALL", "PURCHASE_APPROVE", "PURCHASE_PAY"],
      },
    ],
  },
  {
    icon: <DashboardIcon />,
    name: "工作台",
    requiredAnyPermissions: [
      "PURCHASE_CREATE",
      "PURCHASE_VIEW_DEPARTMENT",
      "PURCHASE_VIEW_ALL",
      "PURCHASE_APPROVE",
      "PURCHASE_REJECT",
      "PURCHASE_PAY",
    ],
    subItems: [
      {
        name: "待办",
        path: "/workflow/todo",
        requiredAnyPermissions: ["PURCHASE_APPROVE", "PURCHASE_REJECT", "PURCHASE_PAY", "PURCHASE_CREATE"],
      },
      {
        name: "已办",
        path: "/workflow/done",
        requiredAnyPermissions: [
          "PURCHASE_CREATE",
          "PURCHASE_VIEW_DEPARTMENT",
          "PURCHASE_VIEW_ALL",
          "PURCHASE_APPROVE",
          "PURCHASE_REJECT",
          "PURCHASE_PAY",
        ],
      },
      {
        name: "通知",
        path: "/workflow/notifications",
        requiredAnyPermissions: [
          "PURCHASE_CREATE",
          "PURCHASE_VIEW_DEPARTMENT",
          "PURCHASE_VIEW_ALL",
          "PURCHASE_APPROVE",
          "PURCHASE_REJECT",
          "PURCHASE_PAY",
        ],
      },
    ],
  },
  {
    icon: <InventoryIcon />,
    name: "进销存",
    subItems: [
      {
        name: "概览",
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
    name: "组织架构",
    icon: <OrgIcon />,
    subItems: [
      {
        name: "员工管理",
        path: "/employees",
        pro: false,
        requiredPermission: "USER_VIEW_ALL",
      },
      {
        name: "部门管理",
        path: "/departments",
        pro: false,
        requiredPermission: "USER_VIEW_ALL",
      },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { hasPermission } = usePermissions();

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

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

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
    <ul className="flex flex-col gap-3">
      {items.map((nav, index) => {
        const isOpen = openSubmenuIndex === index;
        const isActiveRoot = nav.path ? isActive(nav.path) : false;
        return (
          <li key={nav.name} className="space-y-1">
            {nav.subItems ? (
              <Button
                onClick={() => handleSubmenuToggle(index)}
                variant="ghost"
                size="sm"
                className={navButtonStyles(isOpen)}
              >
                <span className={cn('text-lg', isOpen ? 'text-sidebar-primary' : 'text-sidebar-foreground/70')}>
                  {nav.icon}
                </span>
                {showLabels && <span className="text-sm font-medium">{nav.name}</span>}
                {showLabels && (
                  <ChevronDown
                    className={cn('h-4 w-4 text-sidebar-foreground/70 transition-transform', isOpen && 'rotate-180 text-sidebar-primary')}
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
      <div className={cn('py-8 flex', showLabels ? 'justify-start' : 'justify-center lg:justify-center')}>
        <Link href="/" className="mx-auto">
          <Image
            src="/images/logo/logo.png"
            alt="Logo"
            width={150}
            height={40}
          />
        </Link>
      </div>
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
