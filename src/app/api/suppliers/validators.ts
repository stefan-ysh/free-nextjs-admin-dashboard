import type {
  SupplierBankAccountInput,
  SupplierContactInput,
  SupplierListParams,
  SupplierPayload,
  SupplierStatus,
} from '@/types/supplier';

const statusValues: SupplierStatus[] = ['active', 'inactive', 'blacklisted'];

function parseContacts(value: unknown): SupplierContactInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sanitized: SupplierContactInput[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const record = item as SupplierContactInput;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const role = typeof record.role === 'string' ? record.role.trim() : undefined;
    const mobile = typeof record.mobile === 'string' ? record.mobile.trim() : undefined;
    const email = typeof record.email === 'string' ? record.email.trim() : undefined;
    const note = typeof record.note === 'string' ? record.note.trim() : undefined;
    const isPrimary = Boolean(record.isPrimary);
    if (!name && !mobile && !email) return;
    sanitized.push({ name, role, mobile, email, note, isPrimary });
  });

  return sanitized;
}

function parseBankAccounts(value: unknown): SupplierBankAccountInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sanitized: SupplierBankAccountInput[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const record = item as SupplierBankAccountInput;
    const bankName = typeof record.bankName === 'string' ? record.bankName.trim() : '';
    const accountName = typeof record.accountName === 'string' ? record.accountName.trim() : '';
    const accountNumber = typeof record.accountNumber === 'string' ? record.accountNumber.trim() : '';
    if (!bankName || !accountName || !accountNumber) return;
    const branch = typeof record.branch === 'string' ? record.branch.trim() : undefined;
    const country = typeof record.country === 'string' ? record.country.trim() : undefined;
    const currency = typeof record.currency === 'string' ? record.currency.trim() : undefined;
    const swiftCode = typeof record.swiftCode === 'string' ? record.swiftCode.trim() : undefined;
    const note = typeof record.note === 'string' ? record.note.trim() : undefined;
    const isPrimary = typeof record.isPrimary === 'boolean' ? record.isPrimary : index === 0;
    sanitized.push({
      bankName,
      accountName,
      accountNumber,
      branch,
      country,
      currency,
      swiftCode,
      note,
      isPrimary,
    });
  });

  return sanitized;
}

export function parseSupplierListParams(searchParams: URLSearchParams): SupplierListParams {
  const params: SupplierListParams = {};
  const search = searchParams.get('search');
  if (search) params.search = search.trim();

  const status = searchParams.get('status');
  if (status && (statusValues.includes(status as SupplierStatus) || status === 'all')) {
    params.status = status as SupplierStatus | 'all';
  }

  const category = searchParams.get('category');
  if (category) params.category = category.trim();

  const page = Number(searchParams.get('page'));
  if (!Number.isNaN(page) && page > 0) params.page = page;

  const pageSize = Number(searchParams.get('pageSize'));
  if (!Number.isNaN(pageSize) && pageSize > 0) params.pageSize = pageSize;

  return params;
}

export function parseSupplierPayload(body: unknown): SupplierPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('INVALID_SUPPLIER_PAYLOAD');
  }
  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    throw new Error('SUPPLIER_NAME_REQUIRED');
  }

  const payload: SupplierPayload = {
    name,
    shortName: typeof data.shortName === 'string' ? data.shortName.trim() : undefined,
    category: typeof data.category === 'string' ? data.category.trim() : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    taxNumber: typeof data.taxNumber === 'string' ? data.taxNumber.trim() : undefined,
    invoiceTitle: typeof data.invoiceTitle === 'string' ? data.invoiceTitle.trim() : undefined,
    registeredAddress: typeof data.registeredAddress === 'string' ? data.registeredAddress.trim() : undefined,
    officeAddress: typeof data.officeAddress === 'string' ? data.officeAddress.trim() : undefined,
    website: typeof data.website === 'string' ? data.website.trim() : undefined,
    phone: typeof data.phone === 'string' ? data.phone.trim() : undefined,
    mobile: typeof data.mobile === 'string' ? data.mobile.trim() : undefined,
    email: typeof data.email === 'string' ? data.email.trim() : undefined,
    paymentTerm: typeof data.paymentTerm === 'string' ? data.paymentTerm.trim() : undefined,
    creditLimit: typeof data.creditLimit === 'number' ? data.creditLimit : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()) : undefined,
    status: typeof data.status === 'string' && statusValues.includes(data.status as SupplierStatus) ? (data.status as SupplierStatus) : undefined,
    notes: typeof data.notes === 'string' ? data.notes.trim() : undefined,
    contacts: parseContacts(data.contacts),
    bankAccounts: parseBankAccounts(data.bankAccounts),
  };

  return payload;
}
