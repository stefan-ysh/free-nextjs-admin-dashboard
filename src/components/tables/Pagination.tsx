import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100]
}) => {
  // Always show at least page 1
  const safeTotalPages = Math.max(1, totalPages);
  
  const pagesAroundCurrent = Array.from(
    { length: Math.min(3, safeTotalPages) },
    (_, i) => {
      let start = Math.max(currentPage - 1, 1);
      if (start + 2 > safeTotalPages) {
        start = Math.max(safeTotalPages - 2, 1);
      }
      return i + start;
    }
  );

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground w-full justify-between">
      <div className="flex items-center gap-2">
        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-2">
            <span className="text-xs whitespace-nowrap">每页显示</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
              }}
            >
              <SelectTrigger className="w-[70px] text-xs">
                <SelectValue placeholder={pageSize.toString()} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()} className="text-xs">
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs whitespace-nowrap">条记录</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 text-xs"
        >
          上一页
        </Button>
        
        <div className="hidden sm:flex items-center gap-1">
          {pagesAroundCurrent[0] > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(1)}
                className="w-8 px-0 text-xs"
              >
                1
              </Button>
              {pagesAroundCurrent[0] > 2 && <span className="px-1 text-xs">...</span>}
            </>
          )}
          
          {pagesAroundCurrent.map((page) => (
            <Button
              key={page}
              type="button"
              variant={currentPage === page ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onPageChange(page)}
              className="w-8 px-0 text-xs font-medium"
            >
              {page}
            </Button>
          ))}
          
          {pagesAroundCurrent[pagesAroundCurrent.length - 1] < safeTotalPages && (
            <>
              {pagesAroundCurrent[pagesAroundCurrent.length - 1] < safeTotalPages - 1 && (
                <span className="px-1 text-xs">...</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(safeTotalPages)}
                className="w-8 px-0 text-xs"
              >
                {safeTotalPages}
              </Button>
            </>
          )}
        </div>

        <span className="sm:hidden text-xs px-2 font-medium">
          {currentPage} / {safeTotalPages}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= safeTotalPages}
          className="px-3 text-xs"
        >
          下一页
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
