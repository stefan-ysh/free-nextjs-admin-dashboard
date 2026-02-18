import { UserRole } from '@/types/user';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';
export type EmployeeGender = 'male' | 'female' | 'other';

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
	active: '在职',
	on_leave: '休假',
	terminated: '已离职',
};

export const EMPLOYEE_GENDER_LABELS: Record<EmployeeGender, string> = {
	male: '男',
	female: '女',
	other: '其他',
};

export type Employee = {
	id: string;
	userId: string | null;
	userRoles?: UserRole[];
	userPrimaryRole?: UserRole | null;
	employeeCode: string | null;
	displayName: string | null;
	email: string | null;
	phone: string | null;
	gender?: EmployeeGender | null;
	address?: string | null;
	employmentStatus: EmploymentStatus;
	hireDate: string | null;
	terminationDate: string | null;
	location: string | null;
	customFields: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type JobGradeOption = {
	id: string;
	name: string;
	code: string | null;
	level: number | null;
};

export type EmployeeStatusLog = {
	id: string;
	employeeId: string;
	previousStatus: EmploymentStatus;
	nextStatus: EmploymentStatus;
	note: string | null;
	actorId: string | null;
	createdAt: string;
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

export type EmployeeStatusLogResponse = {
	success: boolean;
	data?: EmployeeStatusLog[];
	error?: string;
};

export type EmployeeBulkImportResult = {
	created: number;
	updated: number;
	skipped: number;
	errors: Array<{ index: number; message: string; identifier?: string | null }>;
};

export type EmployeeBulkImportResponse = {
	success: boolean;
	data?: EmployeeBulkImportResult;
	error?: string;
};

export type EmployeeImportRow = {
	id?: string | null;
	employeeCode?: string | null;
	displayName?: string | null;
	email?: string | null;
	phone?: string | null;
	initialPassword?: string | null;
	gender?: EmployeeGender | null;
	address?: string | null;
	employmentStatus?: EmploymentStatus;
	hireDate?: string | null;
	terminationDate?: string | null;
	location?: string | null;
	customFields?: Record<string, string | number | boolean | null> | null;
};

export type EmployeeFormSubmitPayload = {
	employeeCode?: string | null;
	displayName: string;
	email?: string | null;
	phone?: string | null;
	initialPassword?: string | null;
	gender?: EmployeeGender | null;
	address?: string | null;
	employmentStatus: EmploymentStatus;
	hireDate?: string | null;
	terminationDate?: string | null;
	location?: string | null;
	customFields?: Record<string, string> | null;
	statusChangeNote?: string | null;
};

export type EmployeeFilters = {
	search: string;
	status: EmploymentStatus | 'all';
	sortBy: 'updatedAt' | 'createdAt' | 'displayName' | 'status';
	sortOrder: 'asc' | 'desc';
};
