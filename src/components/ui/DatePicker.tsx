'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DatePickerProps = {
  value?: string | null;
  onChange: (date: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  clearable?: boolean;
  containerClassName?: string;
  defaultMonth?: Date;
} & Omit<ButtonProps, 'value' | 'onChange'>;

function formatValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseValue(value?: string | null) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDisplay(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      required = false,
      placeholder = '选择日期',
      helperText,
      clearable = true,
      disabled,
      containerClassName,
      defaultMonth,
      className,
      ...buttonProps
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const handleOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        if (disabled) return;
        setOpen(nextOpen);
      },
      [disabled]
    );

    React.useEffect(() => {
      if (disabled && open) {
        setOpen(false);
      }
    }, [disabled, open]);

    const selectedDate = React.useMemo(() => parseValue(value), [value]);
    const displayValue = selectedDate ? formatDisplay(selectedDate) : placeholder;

    const handleSelect = React.useCallback(
      (day?: Date) => {
        if (!day) return;
        onChange(formatValue(day));
        setOpen(false);
      },
      [onChange]
    );

    const handleClear = React.useCallback(() => {
      onChange('');
      setOpen(false);
    }, [onChange]);

    const showClearButton = clearable && Boolean(value);

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {label && (
          <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              variant="outline"
              type="button"
              disabled={disabled}
              className={cn(
                'w-full justify-between text-left font-normal',
                !selectedDate && 'text-muted-foreground',
                className
              )}
              {...buttonProps}
            >
              {displayValue}
              <CalendarIcon className="ml-2 h-4 w-4 opacity-70" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate ?? defaultMonth}
              onSelect={handleSelect}
              disabled={disabled}
              initialFocus
            />
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  handleSelect(new Date());
                }}
              >
                今天
              </Button>
              {showClearButton && (
                <Button type="button" variant="ghost" className="flex-1" onClick={handleClear}>
                  清除
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
