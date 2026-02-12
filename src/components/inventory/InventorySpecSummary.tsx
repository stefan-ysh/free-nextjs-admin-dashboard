import type { InventoryItem } from '@/types/inventory';

interface InventorySpecSummaryProps {
  item: InventoryItem;
}

export default function InventorySpecSummary({ item }: InventorySpecSummaryProps) {
  const specFields = item.specFields ?? [];
  if (!specFields.length) {
    return <span className="text-xs text-muted-foreground">无规格信息</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {specFields.map((field) => {
        const value = field.defaultValue;
        return (
          <span
            key={field.key}
            className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground"
          >
            {field.label}: {value ?? '—'}
          </span>
        );
      })}
    </div>
  );
}
