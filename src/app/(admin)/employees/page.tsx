import type { Metadata } from 'next';

import EmployeeClient from '@/components/employees/EmployeeClient';

export const metadata: Metadata = {
	title: '员工管理',
};

export default function EmployeesPage() {
	return (
		<section className="space-y-6">
			<EmployeeClient />
		</section>
	);
}
