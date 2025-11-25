import type { ListPurchasesParams } from '@/types/purchase';
import {
  isPurchaseStatus,
  isPurchaseChannel,
  isPaymentMethod,
} from '@/types/purchase';

const SORT_FIELDS = ['createdAt', 'updatedAt', 'purchaseDate', 'totalAmount', 'status', 'submittedAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];
const SORT_ORDERS = ['asc', 'desc'] as const;
type SortOrder = (typeof SORT_ORDERS)[number];

function isSortField(value: string | null): value is SortField {
  return value != null && SORT_FIELDS.includes(value as SortField);
}

function isSortOrder(value: string | null): value is SortOrder {
  return value != null && SORT_ORDERS.includes(value as SortOrder);
}

export function parsePurchaseListParams(searchParams: URLSearchParams): ListPurchasesParams {
  const params: ListPurchasesParams = {};

  params.search = searchParams.get('search') ?? undefined;
  const statusParam = searchParams.get('status');
  if (statusParam === 'all') {
    params.status = 'all';
  } else if (isPurchaseStatus(statusParam)) {
    params.status = statusParam;
  }

  const projectId = searchParams.get('projectId');
  if (projectId) params.projectId = projectId;

  const purchaseChannelParam = searchParams.get('purchaseChannel');
  if (isPurchaseChannel(purchaseChannelParam)) {
    params.purchaseChannel = purchaseChannelParam;
  }

  const paymentMethodParam = searchParams.get('paymentMethod');
  if (isPaymentMethod(paymentMethodParam)) {
    params.paymentMethod = paymentMethodParam;
  }

  params.startDate = searchParams.get('startDate') ?? undefined;
  params.endDate = searchParams.get('endDate') ?? undefined;

  const purchaserIdParam = searchParams.get('purchaserId');
  if (purchaserIdParam) params.purchaserId = purchaserIdParam;

  const minAmountParam = searchParams.get('minAmount');
  if (minAmountParam !== null && minAmountParam.trim() !== '') {
    const minAmount = Number(minAmountParam);
    if (!Number.isNaN(minAmount)) params.minAmount = minAmount;
  }

  const maxAmountParam = searchParams.get('maxAmount');
  if (maxAmountParam !== null && maxAmountParam.trim() !== '') {
    const maxAmount = Number(maxAmountParam);
    if (!Number.isNaN(maxAmount)) params.maxAmount = maxAmount;
  }

  const includeDeleted = searchParams.get('includeDeleted');
  if (includeDeleted === 'true') {
    params.includeDeleted = true;
  }

  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawPageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
  params.page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  params.pageSize = Number.isNaN(rawPageSize) ? 20 : Math.min(Math.max(1, rawPageSize), 200);

  const sortBy = searchParams.get('sortBy');
  if (isSortField(sortBy)) params.sortBy = sortBy;
  const sortOrder = searchParams.get('sortOrder');
  if (isSortOrder(sortOrder)) params.sortOrder = sortOrder;

  return params;
}
