export type SupplierStatus = 'active' | 'inactive' | 'blacklisted';

export interface SupplierContactInput {
  name: string;
  role?: string;
  mobile?: string;
  email?: string;
  isPrimary?: boolean;
  note?: string;
}

export interface SupplierContact extends SupplierContactInput {
  id: string;
  supplierId: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierBankAccountInput {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  country?: string;
  currency?: string;
  swiftCode?: string;
  note?: string;
  isPrimary?: boolean;
}

export interface SupplierBankAccount extends SupplierBankAccountInput {
  id: string;
  supplierId: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayload {
  name: string;
  shortName?: string;
  category?: string;
  rating?: number;
  taxNumber?: string;
  invoiceTitle?: string;
  registeredAddress?: string;
  officeAddress?: string;
  website?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  paymentTerm?: string;
  creditLimit?: number;
  tags?: string[];
  status?: SupplierStatus;
  notes?: string;
  contacts?: SupplierContactInput[];
  bankAccounts?: SupplierBankAccountInput[];
}

export interface Supplier extends SupplierPayload {
  id: string;
  creditLimit: number;
  outstandingAmount: number;
  status: SupplierStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  contacts?: SupplierContact[];
  bankAccounts?: SupplierBankAccount[];
}

export interface SupplierListParams {
  search?: string;
  status?: SupplierStatus | 'all';
  category?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierListResult {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
}
