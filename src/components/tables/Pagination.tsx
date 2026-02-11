import { Button } from '@/components/ui/button';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const pagesAroundCurrent = Array.from(
    { length: Math.min(3, totalPages) },
    (_, i) => i + Math.max(currentPage - 1, 1)
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-9 px-3"
      >
        上一页
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {currentPage > 3 && <span className="px-1">...</span>}
        {pagesAroundCurrent.map((page) => (
          <Button
            key={page}
            type="button"
            variant={currentPage === page ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onPageChange(page)}
            className="h-9 w-9 px-0"
          >
            {page}
          </Button>
        ))}
        {currentPage < totalPages - 2 && <span className="px-1">...</span>}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-9 px-3"
      >
        下一页
      </Button>
    </div>
  );
};

export default Pagination;
