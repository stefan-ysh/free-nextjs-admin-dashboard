import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import EmployeeClient from "@/components/employees/EmployeeClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "员工管理 | Cosmorigin Admin",
  description: "管理员可在此管理员工信息，包括新增、编辑与删除。",
};

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="员工管理" />
      <EmployeeClient />
    </div>
  );
}
