import { NextRequest, NextResponse } from 'next/server';
import { 
  createRecord, 
  getRecords, 
  getRecordsCount,
//   getRecord,
//   updateRecord,
//   deleteRecord 
} from '@/lib/db/finance';
import { FinanceRecord, TransactionType, FinanceApiResponse } from '@/types/finance';

/**
 * GET - 获取财务记录列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const [records, total] = await Promise.all([
      getRecords(startDate, endDate, limit, offset),
      getRecordsCount(startDate, endDate),
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
    const body = await request.json();
    
    // 验证必填字段
    if (!body.name || !body.type || !body.category || !body.date || 
        body.contractAmount === undefined || body.fee === undefined || !body.paymentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 验证类型
    if (![TransactionType.INCOME, TransactionType.EXPENSE].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    // 验证金额
    if (typeof body.contractAmount !== 'number' || body.contractAmount < 0 ||
        typeof body.fee !== 'number' || body.fee < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    const record = await createRecord({
      name: body.name,
      type: body.type,
      contractAmount: body.contractAmount,
      fee: body.fee,
      category: body.category,
      date: body.date,
      paymentType: body.paymentType,
      invoice: body.invoice,
      description: body.description || '',
      tags: body.tags || [],
      createdBy: body.createdBy,
    });

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create record' },
      { status: 500 }
    );
  }
}
