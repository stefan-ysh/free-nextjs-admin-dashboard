import { useQuery } from '@tanstack/react-query';
import type { InventoryItem } from '@/types/inventory';

interface InventoryItemsResponse {
  data: InventoryItem[];
  total: number;
}

export function useInventoryItems(params: {
  page: number;
  pageSize: number;
  search?: string;
}) {
  const { page, pageSize, search } = params;
  
  return useQuery({
    queryKey: ['inventory-items', page, pageSize, search],
    queryFn: async (): Promise<InventoryItemsResponse> => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search?.trim()) {
        qs.set('search', search.trim());
      }
      
      const res = await fetch(`/api/inventory/items?${qs.toString()}`, { 
        cache: 'no-store' 
      });
      const json = await res.json();
      return {
        data: json.data ?? [],
        total: json.total ?? 0,
      };
    },
    staleTime: 30 * 1000,
  });
}
