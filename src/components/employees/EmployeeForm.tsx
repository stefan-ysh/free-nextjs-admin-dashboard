"use client";

import React, { useMemo, useState } from "react";

import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";

import type { EmployeeRecord, EmploymentStatus } from "./types";

export type EmployeeFormValues = {
  employeeCode: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  terminationDate: string | null;
  managerId: string | null;
  location: string | null;
  customFields: Record<string, unknown> | null;
};

interface EmployeeFormProps {
  initialData?: EmployeeRecord | null;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

const STATUS_OPTIONS: { value: EmploymentStatus; label: string }[] = [
  { value: "active", label: "在职" },
  { value: "on_leave", label: "休假" },
  { value: "terminated", label: "离职" },
];

function sanitizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = sanitizeText(value);
  return trimmed.length ? trimmed : null;
}

export default function EmployeeForm({ initialData, onSubmit, onCancel, submitting }: EmployeeFormProps) {
  const [firstName, setFirstName] = useState(() => initialData?.firstName ?? "");
  const [lastName, setLastName] = useState(() => initialData?.lastName ?? "");
  const [displayName, setDisplayName] = useState(() => initialData?.displayName ?? "");
  const [employeeCode, setEmployeeCode] = useState(() => initialData?.employeeCode ?? "");
  const [email, setEmail] = useState(() => initialData?.email ?? "");
  const [phone, setPhone] = useState(() => initialData?.phone ?? "");
  const [department, setDepartment] = useState(() => initialData?.department ?? "");
  const [jobTitle, setJobTitle] = useState(() => initialData?.jobTitle ?? "");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>(() => initialData?.employmentStatus ?? "active");
  const [hireDate, setHireDate] = useState(() => initialData?.hireDate ?? "");
  const [terminationDate, setTerminationDate] = useState(() => initialData?.terminationDate ?? "");
  const [managerId, setManagerId] = useState(() => initialData?.managerId ?? "");
  const [location, setLocation] = useState(() => initialData?.location ?? "");
  const [customFieldsInput, setCustomFieldsInput] = useState(() =>
    initialData && Object.keys(initialData.customFields || {}).length
      ? JSON.stringify(initialData.customFields, null, 2)
      : ""
  );
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(() => STATUS_OPTIONS, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const requiredFirst = sanitizeText(firstName);
    const requiredLast = sanitizeText(lastName);

    if (!requiredFirst || !requiredLast) {
      setError("请填写名字与姓氏");
      return;
    }

    let parsedCustom: Record<string, unknown> | null = null;
    if (customFieldsInput.trim()) {
      try {
        const parsed = JSON.parse(customFieldsInput);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setError("自定义字段必须是 JSON 对象");
          return;
        }
        parsedCustom = parsed as Record<string, unknown>;
      } catch (err) {
        console.error("解析自定义字段失败", err);
        setError("自定义字段 JSON 格式不正确");
        return;
      }
    }

    setError(null);
    try {
      await onSubmit({
        employeeCode: nullable(employeeCode),
        firstName: requiredFirst,
        lastName: requiredLast,
        displayName: nullable(displayName),
        email: nullable(email),
        phone: nullable(phone),
        department: nullable(department),
        jobTitle: nullable(jobTitle),
        employmentStatus,
        hireDate: nullable(hireDate),
        terminationDate: nullable(terminationDate),
        managerId: nullable(managerId),
        location: nullable(location),
        customFields: parsedCustom,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "提交失败，请稍后重试";
      setError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>
            名字 <span className="text-error-500">*</span>
          </Label>
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="请输入名字" />
        </div>
        <div>
          <Label>
            姓氏 <span className="text-error-500">*</span>
          </Label>
          <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="请输入姓氏" />
        </div>
        <div>
          <Label>显示名称</Label>
          <Input value={displayName ?? ""} onChange={(event) => setDisplayName(event.target.value)} placeholder="展示用姓名" />
        </div>
        <div>
          <Label>员工编号</Label>
          <Input value={employeeCode ?? ""} onChange={(event) => setEmployeeCode(event.target.value)} placeholder="如 EMP-001" />
        </div>
        <div>
          <Label>邮箱</Label>
          <Input type="email" value={email ?? ""} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        </div>
        <div>
          <Label>手机号</Label>
          <Input value={phone ?? ""} onChange={(event) => setPhone(event.target.value)} placeholder="联系电话" />
        </div>
        <div>
          <Label>部门</Label>
          <Input value={department ?? ""} onChange={(event) => setDepartment(event.target.value)} placeholder="所属部门" />
        </div>
        <div>
          <Label>职位</Label>
          <Input value={jobTitle ?? ""} onChange={(event) => setJobTitle(event.target.value)} placeholder="当前职位" />
        </div>
        <div>
          <Label>入职日期</Label>
          <Input type="date" value={hireDate ?? ""} onChange={(event) => setHireDate(event.target.value)} />
        </div>
        <div>
          <Label>离职日期</Label>
          <Input type="date" value={terminationDate ?? ""} onChange={(event) => setTerminationDate(event.target.value)} />
        </div>
        <div>
          <Label>经理 ID</Label>
          <Input value={managerId ?? ""} onChange={(event) => setManagerId(event.target.value)} placeholder="上级用户 ID" />
        </div>
        <div>
          <Label>办公地点</Label>
          <Input value={location ?? ""} onChange={(event) => setLocation(event.target.value)} placeholder="办公地点" />
        </div>
        <div className="sm:col-span-2">
          <Label>状态</Label>
          <select
            className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
            value={employmentStatus}
            onChange={(event) => setEmploymentStatus(event.target.value as EmploymentStatus)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value} className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label>自定义字段 (JSON)</Label>
          <TextArea
            value={customFieldsInput}
            onChange={setCustomFieldsInput}
            placeholder='{"薪资": "10000", "技能": ["React", "Node.js"]}'
            rows={4}
          />
        </div>
      </div>

      {error && <p className="text-sm text-error-500">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中..." : "保存"}
        </Button>
      </div>
    </form>
  );
}
