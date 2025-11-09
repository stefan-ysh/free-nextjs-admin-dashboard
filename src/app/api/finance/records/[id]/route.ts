import { NextRequest, NextResponse } from 'next/server';
import { getRecord, updateRecord, deleteRecord } from '@/lib/db/finance';
import { FinanceApiResponse, FinanceRecord } from '@/types/finance';

/**
 * GET - 获取单条记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const record = await getRecord(params.id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch record' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - 更新记录
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    const record = await updateRecord(params.id, body);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    const response: FinanceApiResponse<FinanceRecord> = {
      success: true,
      data: record,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 删除记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await deleteRecord(params.id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete record' },
      { status: 500 }
    );
  }
}
