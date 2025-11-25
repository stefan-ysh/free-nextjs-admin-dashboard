import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { requireCurrentUser } from '@/lib/auth/current-user';
import { toPermissionUser } from '@/lib/auth/permission-user';
import {
  createRecord,
  getRecords,
  getRecordsCount,
  //   getRecord,
  //   updateRecord,
  //   deleteRecord
} from '@/lib/db/finance';
import { checkPermission, Permissions } from '@/lib/permissions';
import { FinanceRecord, FinanceApiResponse, TransactionType, PaymentType } from '@/types/finance';
import { financeRecordSchema } from '@/lib/validations/finance';

type MysqlError = {
  code?: string;
  sqlMessage?: string;
};

function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 });
}

function badRequestResponse(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

function parseNumberParam(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function generateTransactionNo(date: string) {
  const datePart = (date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `FIN-${datePart}-${suffix}`;
}

/**
 * GET - 获取财务记录列表
 */
export async function GET(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_VIEW_ALL);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const requestedPage = Number.parseInt(searchParams.get('page') || '', 10);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10);
    const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage);
    const limit = Number.isNaN(requestedLimit)
      ? 20
      : Math.min(Math.max(1, requestedLimit), 200);
    const offset = (page - 1) * limit;

    const typeParam = searchParams.get('type') as TransactionType | null;
    const paymentParam = searchParams.get('paymentType') as PaymentType | null;
    const category = searchParams.get('category') || undefined;
    const keyword = searchParams.get('keyword')?.trim() || undefined;
    const minAmount = parseNumberParam(searchParams.get('minAmount'));
    const maxAmount = parseNumberParam(searchParams.get('maxAmount'));

    const typeFilter = typeParam && [TransactionType.INCOME, TransactionType.EXPENSE].includes(typeParam)
      ? typeParam
      : undefined;

    const paymentType = paymentParam && Object.values(PaymentType).includes(paymentParam)
      ? paymentParam
      : undefined;

    const filters = {
      startDate,
      endDate,
      type: typeFilter,
      paymentType,
      category: category || undefined,
      keyword,
      minAmount,
      maxAmount,
    } as const;

    const [records, total] = await Promise.all([
      getRecords({ ...filters, limit, offset }),
      getRecordsCount(filters),
    ]);

    const response: FinanceApiResponse<FinanceRecord[]> = {
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }
    console.error('Error fetching records:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch records' },
      { status: 500 }
    );
  }
}

/**
 * POST - 创建新的财务记录
 */
export async function POST(request: NextRequest) {
  try {
    const context = await requireCurrentUser();
    const permissionUser = await toPermissionUser(context.user);
    const perm = await checkPermission(permissionUser, Permissions.FINANCE_MANAGE);
    if (!perm.allowed) {
      return forbiddenResponse();
    }

    const json = await request.json();
    const result = financeRecordSchema.safeParse(json);

    if (!result.success) {
      return badRequestResponse(result.error.errors[0].message);
    }

    const body = result.data;
    const paymentChannel = body.paymentChannel?.trim() || undefined;
    const payer = body.payer?.trim() || undefined;
    const transactionNo = body.transactionNo?.trim() || generateTransactionNo(body.date);

    const record = await createRecord({
      name: body.name,
      type: body.type,
      contractAmount: body.contractAmount,
      fee: body.fee,
      quantity: body.quantity ?? 1,
      category: body.category,
      date: body.date,
      paymentType: body.paymentType,
      paymentChannel,
      payer,
      transactionNo,
      invoice: body.invoice,
      description: body.description || '',
      tags: body.tags || [],
      createdBy: context.user.id,
      sourceType: body.sourceType,
      purchaseId: body.purchaseId,
      projectId: body.projectId,
      status: body.status ?? 'draft',
    });

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return unauthorizedResponse();
    }

    const mapped = mapFinanceCreationError(error);
    if (mapped) {
      return NextResponse.json({ success: false, error: mapped.message }, { status: mapped.status });
    }

    console.error('Error creating record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create record' },
      { status: 500 }
    );
  }
}

function mapFinanceCreationError(error: unknown): { status: number; message: string } | null {
  if (error instanceof Error) {
    if (error.message === 'INVALID_DATE') {
      return { status: 400, message: '日期格式不正确，请重新选择日期' };
    }
    if (error.message === 'FAILED_TO_CREATE_FINANCE_RECORD') {
      return { status: 500, message: '记录写入失败，请稍后重试' };
    }
    if (error.message === 'FILE_TOO_LARGE') {
      return { status: 400, message: '附件超过单文件大小限制 (5MB)' };
    }
    if (error.message === 'UNSUPPORTED_FILE_TYPE') {
      return { status: 400, message: '附件类型不受支持，请上传图片或 PDF' };
    }
    if (error.message.includes('base64')) {
      return { status: 400, message: '附件格式不正确，请重新上传' };
    }
  }

  const mysqlError = error as MysqlError;
  switch (mysqlError.code) {
    case 'ER_DATA_TOO_LONG':
      return { status: 400, message: '输入内容超出长度限制，请精简后再提交' };
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return { status: 400, message: '部分字段值格式不正确，请检查金额、日期和类型' };
    case 'ER_BAD_NULL_ERROR':
      return { status: 400, message: '缺少必填字段，请补充完整后提交' };
    case 'ER_LOCK_DEADLOCK':
      return { status: 503, message: '服务器忙，请稍后再试' };
    default:
      break;
  }

  if (mysqlError.sqlMessage?.includes('DATE')) {
    return { status: 400, message: '日期字段格式非法，请使用 YYYY-MM-DD' };
  }

  return null;
}
