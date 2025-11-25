import type { Metadata } from 'next';

import DepartmentManager from '@/components/hr/DepartmentManager';

export const metadata: Metadata = {
  title: '部门管理',
};

export default function DepartmentsPage() {
  return <DepartmentManager />;
}
