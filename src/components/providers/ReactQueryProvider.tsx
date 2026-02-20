'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

interface ReactQueryProviderProps {
    children: ReactNode;
}

export default function ReactQueryProvider({ children }: ReactQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </QueryClientProvider>
    );
}
