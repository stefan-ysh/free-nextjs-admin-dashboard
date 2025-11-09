import { NextRequest, NextResponse } from 'next/server';
import { getCategories, addCategory } from '@/lib/db/finance';
import { TransactionType, FinanceApiResponse } from '@/types/finance';

/**
 * GET - 获取分类列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as TransactionType;

    if (!type || ![TransactionType.INCOME, TransactionType.EXPENSE].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type parameter' },
        { status: 400 }
      );
    }

    const categories = await getCategories(type);

    const response: FinanceApiResponse<string[]> = {
      success: true,
      data: categories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

/**
 * POST - 添加新分类
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.type || !body.category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (![TransactionType.INCOME, TransactionType.EXPENSE].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    await addCategory(body.type, body.category);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add category' },
      { status: 500 }
    );
  }
}
