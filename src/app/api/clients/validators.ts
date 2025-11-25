import type { ClientAddress, ClientContactInput, ClientListParams, ClientPayload } from '@/types/client';
import { isClientStatus, isClientType, isClientSource } from '@/types/client';

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function parseAddress(value: unknown): ClientAddress | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const address: ClientAddress = {};
  const keys: (keyof ClientAddress)[] = ['country', 'province', 'city', 'district', 'street', 'zipcode', 'contact', 'phone'];
  let hasField = false;
  for (const key of keys) {
    const val = optionalString(source[key]);
    if (val) {
      address[key] = val;
      hasField = true;
    }
  }
  return hasField ? address : undefined;
}

function parseTags(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const tags = value.map((item) => optionalString(item)?.trim()).filter((tag): tag is string => Boolean(tag));
    return tags.length ? Array.from(new Set(tags)) : [];
  }
  if (typeof value === 'string') {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return tags.length ? Array.from(new Set(tags)) : [];
  }
  return undefined;
}

function parseCreditLimit(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error('INVALID_CREDIT_LIMIT');
  }
  return numberValue;
}

function normalizeStatus(value: unknown): ClientPayload['status'] | undefined {
  const text = optionalString(value);
  if (!text) return undefined;
  if (isClientStatus(text)) return text;
  throw new Error('INVALID_CLIENT_STATUS');
}

function normalizeType(value: unknown): ClientPayload['type'] {
  const text = optionalString(value);
  if (!text || !isClientType(text)) {
    throw new Error('INVALID_CLIENT_TYPE');
  }
  return text;
}

function normalizeSource(value: unknown): ClientPayload['source'] | undefined {
  const text = optionalString(value);
  if (!text) return undefined;
  if (isClientSource(text)) return text;
  throw new Error('INVALID_CLIENT_SOURCE');
}

function parseContacts(value: unknown): ClientContactInput[] | undefined {
  if (value == null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error('INVALID_CLIENT_CONTACTS');
  }
  const contacts: ClientContactInput[] = value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const source = item as Record<string, unknown>;
      const name = optionalString(source.name)?.trim();
      if (!name) return null;
      const contact: ClientContactInput = {
        name,
        role: optionalString(source.role)?.trim() || undefined,
        mobile: optionalString(source.mobile)?.trim() || undefined,
        email: optionalString(source.email)?.trim() || undefined,
        isPrimary: Boolean(source.isPrimary),
      };
      return contact;
    })
    .filter((contact): contact is ClientContactInput => contact !== null);

  if (!contacts.length) {
    return [];
  }

  const hasPrimary = contacts.some((contact) => contact.isPrimary);
  if (!hasPrimary) {
    contacts[0].isPrimary = true;
  }
  return contacts;
}

export function parseClientListParams(searchParams: URLSearchParams): ClientListParams {
  const params: ClientListParams = {};
  const search = searchParams.get('search');
  if (search) params.search = search.trim();

  const type = searchParams.get('type');
  if (type) params.type = isClientType(type) ? type : 'all';

  const status = searchParams.get('status');
  if (status) params.status = status === 'all' ? 'all' : isClientStatus(status) ? status : undefined;

  const ownerId = searchParams.get('ownerId');
  if (ownerId) params.ownerId = ownerId;

  const page = Number(searchParams.get('page'));
  if (Number.isFinite(page) && page > 0) params.page = page;

  const pageSize = Number(searchParams.get('pageSize'));
  if (Number.isFinite(pageSize) && pageSize > 0) params.pageSize = pageSize;

  return params;
}

function parseCore(payload: unknown, { partial }: { partial: boolean }): Partial<ClientPayload> {
  if (!payload || typeof payload !== 'object') {
    throw new Error('INVALID_CLIENT_PAYLOAD');
  }
  const source = payload as Record<string, unknown>;
  const result: Partial<ClientPayload> = {};

  if (!partial || source.type != null) {
    result.type = normalizeType(source.type);
  }

  if (!partial || source.displayName != null) {
    const displayName = optionalString(source.displayName)?.trim();
    if (!displayName) throw new Error('CLIENT_NAME_REQUIRED');
    result.displayName = displayName;
  }

  result.companyName = optionalString(source.companyName)?.trim() || undefined;
  result.contactPerson = optionalString(source.contactPerson)?.trim() || undefined;
  result.mobile = optionalString(source.mobile)?.trim() || undefined;
  result.email = optionalString(source.email)?.trim() || undefined;
  result.taxNumber = optionalString(source.taxNumber)?.trim() || undefined;
  result.invoiceTitle = optionalString(source.invoiceTitle)?.trim() || undefined;
  result.paymentTerm = optionalString(source.paymentTerm)?.trim() || undefined;
  result.notes = optionalString(source.notes)?.trim() || undefined;

  if (source.billingAddress != null) result.billingAddress = parseAddress(source.billingAddress);
  if (source.shippingAddress != null) result.shippingAddress = parseAddress(source.shippingAddress);

  if (source.creditLimit != null) result.creditLimit = parseCreditLimit(source.creditLimit);
  if (source.tags != null) result.tags = parseTags(source.tags);
  if (source.status != null) result.status = normalizeStatus(source.status);
  if (source.source != null) result.source = normalizeSource(source.source);
  if (source.contacts != null) result.contacts = parseContacts(source.contacts);

  return result;
}

export function parseClientPayload(payload: unknown): ClientPayload {
  const parsed = parseCore(payload, { partial: false });
  return parsed as ClientPayload;
}

export function parsePartialClientPayload(payload: unknown): Partial<ClientPayload> {
  return parseCore(payload, { partial: true });
}
