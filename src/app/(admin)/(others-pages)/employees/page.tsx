import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Employees",
	description: "Employee management dashboard",
};

export default function EmployeesPage() {
	return (
		<section className="space-y-4">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
				<p className="text-sm text-muted-foreground">
					Employee management tools are coming soon.
				</p>
			</header>
			<div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
				This page is currently a placeholder to keep the build green. Replace it
				with the production-ready employee management experience when the
				feature is implemented.
			</div>
		</section>
	);
}
