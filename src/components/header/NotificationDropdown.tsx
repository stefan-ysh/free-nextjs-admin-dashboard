"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationRecord = {
  id: string;
  eventType: string;
  title: string;
  content: string;
  linkUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

type NotificationListResponse = {
  success: boolean;
  data?: { items: NotificationRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type ApprovalFallback = {
  id: string;
  purchaseNumber: string;
  itemName: string;
  totalAmount: number;
  updatedAt: string;
};

type ApprovalListResponse = {
  success: boolean;
  data?: { items: ApprovalFallback[]; total: number; page: number; pageSize: number };
  error?: string;
};

type UiNotificationItem = {
  id: string;
  eventType: string;
  title: string;
  subtitle: string;
  time: string;
  link: string;
  unread: boolean;
  type: "approval" | "applicant" | "finance" | "other";
  source: "in_app" | "pending_approval";
};

function timeAgo(dateValue: string): string {
  const ms = Date.now() - new Date(dateValue).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "刚刚";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "刚刚";
  if (ms < hour) return `${Math.floor(ms / minute)} 分钟前`;
  if (ms < day) return `${Math.floor(ms / hour)} 小时前`;
  return `${Math.floor(ms / day)} 天前`;
}

function mapType(eventType: string): UiNotificationItem["type"] {
  if (eventType === "purchase_submitted") return "approval";
  if (eventType === "purchase_approved" || eventType === "purchase_rejected" || eventType === "purchase_paid") return "applicant";
  if (eventType === "purchase_transferred") return "approval";
  if (eventType === "reimbursement_submitted") return "finance";
  if (eventType === "reimbursement_approved" || eventType === "reimbursement_paid") return "finance";
  if (eventType === "reimbursement_rejected") return "applicant";
  if (eventType === "payment_issue_marked" || eventType === "payment_issue_resolved") return "finance";
  return "other";
}

function toWorkbenchLink(eventType: string, linkUrl: string | null): string {
  if (eventType === "purchase_submitted" || eventType === "purchase_transferred" || eventType === "reimbursement_submitted") return "/workflow/todo";
  if (eventType === "reimbursement_approved" || eventType === "reimbursement_rejected" || eventType === "reimbursement_paid") return "/reimbursements";
  if (eventType === "payment_issue_marked" || eventType === "payment_issue_resolved") return "/workflow/notifications";
  if (eventType === "purchase_paid" || eventType === "purchase_approved" || eventType === "purchase_rejected") return "/workflow/notifications";
  if (!linkUrl) return "/workflow/notifications";
  if (linkUrl.startsWith("/m/tasks")) return "/workflow/todo";
  if (linkUrl.startsWith("/m/history")) return "/workflow/done";
  if (linkUrl.startsWith("/m/notifications")) return "/workflow/notifications";
  return linkUrl;
}

function getNextActionLabel(eventType: string, type: UiNotificationItem["type"]): string {
  if (eventType === "purchase_submitted" || eventType === "purchase_transferred") return "去审批";
  if (eventType === "reimbursement_submitted") return "去打款";
  if (eventType === "reimbursement_approved") return "去打款";
  if (eventType === "reimbursement_rejected") return "去修改";
  if (eventType === "reimbursement_paid") return "看结果";
  if (eventType === "purchase_rejected") return "去修改";
  if (eventType === "payment_issue_marked") return "去处理";
  if (eventType === "payment_issue_resolved") return "看进度";
  if (eventType === "purchase_approved") return "去采购";
  if (eventType === "purchase_paid") return "看结果";
  return type === "approval" ? "去处理" : "查看";
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UiNotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "todo" | "notice">("all");

  const markAsRead = useCallback(async (options: { ids?: string[]; markAll?: boolean }) => {
    const payload = {
      ids: options.ids ?? [],
      markAll: options.markAll === true,
    };
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notificationsResponse, approvalsResponse] = await Promise.all([
        fetch("/api/notifications?page=1&pageSize=20", {
          headers: { Accept: "application/json" },
        }),
        fetch("/api/purchases/approvals?page=1&pageSize=10", {
          headers: { Accept: "application/json" },
        }),
      ]);

      const normalized: UiNotificationItem[] = [];
      const approvalRelatedIds = new Set<string>();

      if (notificationsResponse.ok) {
        const payload = (await notificationsResponse.json()) as NotificationListResponse;
        if (payload.success && payload.data) {
          for (const item of payload.data.items) {
            const mappedType = mapType(item.eventType);
            if (mappedType === "approval" && item.relatedId) {
              approvalRelatedIds.add(item.relatedId);
            }
            normalized.push({
              id: item.id,
              eventType: item.eventType,
              title: item.title,
              subtitle: item.content.split("\n")[0] ?? item.content,
              time: timeAgo(item.createdAt),
              link: toWorkbenchLink(item.eventType, item.linkUrl),
              unread: !item.isRead,
              type: mappedType,
              source: "in_app",
            });
          }
        }
      }

      if (approvalsResponse.ok) {
        const approvalPayload = (await approvalsResponse.json()) as ApprovalListResponse;
        if (approvalPayload.success && approvalPayload.data?.items?.length) {
          for (const item of approvalPayload.data.items) {
            if (approvalRelatedIds.has(item.id)) {
              continue;
            }
            normalized.push({
              id: `fallback-${item.id}`,
              eventType: "purchase_submitted",
              title: `采购待审批：${item.itemName}`,
              subtitle: `单号 ${item.purchaseNumber}`,
              time: timeAgo(item.updatedAt),
              link: "/workflow/todo",
              unread: true,
              type: "approval",
              source: "pending_approval",
            });
          }
        }
      }

      if (normalized.length === 0 && !notificationsResponse.ok && !approvalsResponse.ok) {
        throw new Error("加载通知失败");
      }

      setItems(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载通知失败");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadNotifications();
    }
  }, [open, loadNotifications]);

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items]);
  const showingNotifyDot = unreadCount > 0;
  const tabCounters = useMemo(() => {
    const todo = items.filter((item) => item.type === "approval").length;
    const notice = items.filter((item) => item.type !== "approval").length;
    return { all: items.length, todo, notice };
  }, [items]);
  const visibleItems = useMemo(() => {
    if (activeTab === "todo") {
      return items.filter((item) => item.type === "approval");
    }
    if (activeTab === "notice") {
      return items.filter((item) => item.type !== "approval");
    }
    return items;
  }, [activeTab, items]);

  const typePillClass: Record<UiNotificationItem["type"], string> = {
    approval: "bg-chart-3/15 text-chart-3",
    applicant: "bg-chart-2/15 text-chart-2",
    finance: "bg-chart-5/15 text-chart-5",
    other: "bg-muted text-muted-foreground",
  };

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = items
      .filter((item) => item.unread && item.source === "in_app")
      .map((item) => item.id);
    if (unreadIds.length === 0) return;

    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    void markAsRead({ ids: unreadIds });
  }, [items, markAsRead]);

  const handleItemOpen = useCallback((item: UiNotificationItem) => {
    setOpen(false);
    if (!item.unread || item.source !== "in_app") return;
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, unread: false } : entry)));
    void markAsRead({ ids: [item.id] });
  }, [markAsRead]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span
            className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-primary ${
              showingNotifyDot ? "flex" : "hidden"
            }`}
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          </span>
          <svg
            className="fill-current"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="surface-card z-[120] flex h-[480px] w-[360px] flex-col rounded-xl bg-popover p-3"
      >
        <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <h5 className="text-lg font-semibold text-popover-foreground">
            通知
          </h5>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">未读 {unreadCount}</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              全部已读
            </button>
            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              刷新
            </button>
          </div>
        </div>

        {!loading && !error ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "全部", count: tabCounters.all },
              { key: "todo", label: "待办", count: tabCounters.todo },
              { key: "notice", label: "通知", count: tabCounters.notice },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeTab === tab.key
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label} {tab.count}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载中...</div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <ul className="custom-scrollbar flex flex-1 flex-col overflow-y-auto">
            {visibleItems.length === 0 ? (
              <li className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无通知</li>
            ) : (
              visibleItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link}
                    onClick={() => handleItemOpen(item)}
                    className="block rounded-lg border-b border-border px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {item.unread ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" /> : null}
                        {item.title}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${typePillClass[item.type]}`}>
                        {item.type === "approval"
                          ? "待审批"
                          : item.type === "applicant"
                            ? "通知"
                            : item.type === "finance"
                              ? "财务"
                              : "其他"}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">{item.time}</p>
                      <span className="text-[11px] font-medium text-primary">
                        {getNextActionLabel(item.eventType, item.type)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        ) : null}

        <Link
          href="/workflow/notifications"
          onClick={() => setOpen(false)}
          className="mt-3 block rounded-lg border border-border bg-card px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-muted"
        >
          查看全部通知
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
