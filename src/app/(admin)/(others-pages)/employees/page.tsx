import EmployeeClient from '@/components/employees/EmployeeClient';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';

export default function EmployeesPage() {
	return (
		<section className="space-y-6">
			<PageBreadCrumb pageTitle="员工管理" />
			<EmployeeClient />
		</section>
	);
}
