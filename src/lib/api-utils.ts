import { NextResponse } from 'next/server';

export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
};

/**
 * Returns a standardized success response.
 * @param data The payload to return.
 * @param status HTTP status code (default: 200).
 */
export function successResponse<T>(data: T, status = 200) {
    return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

/**
 * Returns a standardized error response.
 * @param message Error message.
 * @param status HTTP status code (default: 500).
 * @param code Optional error code for client-side handling.
 */
export function errorResponse(message: string, status = 500, code?: string) {
    return NextResponse.json<ApiResponse>(
        { success: false, error: message, code },
        { status }
    );
}

/**
 * Centralized error handler for API routes.
 * Logs the error and returns a standardized error response.
 * @param error The caught error object.
 * @param context Optional context string for logging.
 */
export function handleApiError(error: unknown, context = 'API Error') {
    console.error(`[${context}]`, error);

    if (error instanceof Error) {
        // Handle specific known error patterns here if needed
        if (error.message === 'UNAUTHENTICATED') {
            return errorResponse('未登录', 401, 'UNAUTHENTICATED');
        }
        if (error.message === 'FORBIDDEN' || error.message === 'PERMISSION_DENIED') {
            return errorResponse('无权访问', 403, 'FORBIDDEN');
        }
        if (error.message === 'NOT_FOUND') {
            return errorResponse('资源不存在', 404, 'NOT_FOUND');
        }
        // Pass through custom error messages if they are safe to show
        // For now, we assume Error.message is safe if it's not a system error
        return errorResponse(error.message, 500);
    }

    return errorResponse('服务器内部错误', 500, 'INTERNAL_SERVER_ERROR');
}
