import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/db/finance';
import { FinanceApiResponse, FinanceStats } from '@/types/finance';

/**
 * GET - 获取财务统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const stats = await getStats(startDate, endDate);

    const response: FinanceApiResponse<FinanceStats> = {
      success: true,
      data: stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
