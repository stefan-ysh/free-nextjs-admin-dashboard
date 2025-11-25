export type ClientType = 'personal' | 'company';
export type ClientStatus = 'active' | 'inactive' | 'blacklisted';
export type ClientSource = 'manual' | 'import' | 'project' | 'other';

export function isClientType(value: string | null | undefined): value is ClientType {
  return value === 'personal' || value === 'company';
}

export function isClientStatus(value: string | null | undefined): value is ClientStatus {
  return value === 'active' || value === 'inactive' || value === 'blacklisted';
}

export function isClientSource(value: string | null | undefined): value is ClientSource {
  return value === 'manual' || value === 'import' || value === 'project' || value === 'other';
}

export interface ClientAddress {
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  zipcode?: string;
  contact?: string;
  phone?: string;
}

export interface Client {
  id: string;
  type: ClientType;
  displayName: string;
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  taxNumber?: string;
  invoiceTitle?: string;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  paymentTerm?: string;
  creditLimit: number;
  outstandingAmount: number;
  tags: string[];
  status: ClientStatus;
  ownerId?: string;
  source: ClientSource;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  contacts?: ClientContact[];
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role?: string;
  mobile?: string;
  email?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientContactInput {
  name: string;
  role?: string;
  mobile?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface ClientLog {
  id: string;
  clientId: string;
  operatorId: string;
  action: 'create' | 'update' | 'follow_up' | 'new_outbound' | 'payment' | 'change_status';
  content: string;
  nextFollowUp?: string;
  createdAt: string;
}

export interface ClientPayload {
  type: ClientType;
  displayName: string;
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  taxNumber?: string;
  invoiceTitle?: string;
  billingAddress?: ClientAddress;
  shippingAddress?: ClientAddress;
  paymentTerm?: string;
  creditLimit?: number;
  tags?: string[];
  status?: ClientStatus;
  source?: ClientSource;
  notes?: string;
  contacts?: ClientContactInput[];
}

export interface ClientListParams {
  search?: string;
  type?: ClientType | 'all';
  status?: ClientStatus | 'all';
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export interface ClientListResult {
  items: Client[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientStats {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  blacklistedClients: number;
  newClients30d: number;
  totalCredit: number;
  outstanding: number;
  topOutstandingClients: Array<{
    id: string;
    displayName: string;
    status: ClientStatus;
    outstandingAmount: number;
  }>;
}
