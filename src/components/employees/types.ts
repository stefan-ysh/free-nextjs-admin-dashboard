export type EmploymentStatus = "active" | "on_leave" | "terminated";

export type EmployeeRecord = {
  id: string;
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
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeListResponse = {
  items: EmployeeRecord[];
  total: number;
  page: number;
  pageSize: number;
  availableDepartments: string[];
};
