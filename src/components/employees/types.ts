export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
	active: '在职',
	on_leave: '休假',
	terminated: '已离职',
};

export type Employee = {
	id: string;
	employeeCode: string | null;
	firstName: string;
	lastName: string;
	displayName: string | null;
	avatarUrl: string | null;
	email: string | null;
	phone: string | null;
	department: string | null;
	jobTitle: string | null;
	employmentStatus: EmploymentStatus;
	hireDate: string | null;
	terminationDate: string | null;
	managerId: string | null;
	location: string | null;
	customFields: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type EmployeeList = {
	items: Employee[];
	total: number;
	page: number;
	pageSize: number;
};

export type EmployeeListResponse = {
	success: boolean;
	data?: EmployeeList;
	error?: string;
};

export type EmployeeMutationResponse = {
	success: boolean;
	data?: Employee;
	error?: string;
};

export type EmployeeFormSubmitPayload = {
	employeeCode?: string | null;
	firstName: string;
	lastName: string;
	displayName?: string | null;
	avatarDataUrl?: string | null;
	removeAvatar?: boolean;
	email?: string | null;
	phone?: string | null;
	department?: string | null;
	jobTitle?: string | null;
	employmentStatus: EmploymentStatus;
	hireDate?: string | null;
	terminationDate?: string | null;
	managerId?: string | null;
	location?: string | null;
	customFields?: Record<string, string> | null;
};

export type EmployeeFilters = {
	search: string;
	department: string | null;
	status: EmploymentStatus | 'all';
	sortBy: 'updatedAt' | 'createdAt' | 'lastName' | 'department' | 'status';
	sortOrder: 'asc' | 'desc';
};
