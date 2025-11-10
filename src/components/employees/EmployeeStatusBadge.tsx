import React from "react";

import Badge from "@/components/ui/badge/Badge";

import type { EmploymentStatus } from "./types";

const STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: "在职",
  on_leave: "休假",
  terminated: "离职",
};

const STATUS_COLOR: Record<EmploymentStatus, "success" | "warning" | "error"> = {
  active: "success",
  on_leave: "warning",
  terminated: "error",
};

export default function EmployeeStatusBadge({ status }: { status: EmploymentStatus }) {
  return (
    <Badge size="sm" color={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
