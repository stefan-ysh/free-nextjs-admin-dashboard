export type DepartmentRecord = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type JobGradeRecord = {
  id: string;
  name: string;
  code: string | null;
  level: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
