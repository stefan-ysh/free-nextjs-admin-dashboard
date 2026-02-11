'use client';

import * as React from 'react';
import { parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dates';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  clearable?: boolean;
  disabled?: boolean;
  containerClassName?: string;
  defaultMonth?: Date;
} & Omit<ButtonProps, 'value' | 'onChange'>;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHINA_TIMEZONE = 'Asia/Shanghai';

const dateLabelFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CHINA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'long',
});

function formatChinaDateLabel(date: Date): string {
  const parts = dateLabelFormatter.formatToParts(date);
  const resolved: Partial<Record<string, string>> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      resolved[part.type] = part.value;
    }
  }
  const year = resolved.year ?? '';
  const month = resolved.month ?? '';
  const day = resolved.day ?? '';
  const weekday = resolved.weekday ?? '';
  return `${year}年${month}月${day}日 ${weekday}`.trim();
}

function parseValue(value?: string | null) {
  if (!value) return undefined;
  try {
    if (DATE_ONLY_PATTERN.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const parsed = new Date(year, month - 1, day);
      return isValid(parsed) ? parsed : undefined;
    }
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  } catch (error) {
    return undefined;
  }
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      label,
      required,
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

    const parsedDate = React.useMemo(() => parseValue(value), [value]);
    const displayLabel = parsedDate ? formatChinaDateLabel(parsedDate) : placeholder;

    const handleSelect = React.useCallback(
      (date?: Date) => {
        if (!date) return;
        const formatted = formatDateOnly(date);
        if (!formatted) return;
        onChange(formatted);
        setOpen(false);
      },
      [onChange]
    );

    const handleOpenChange = React.useCallback(
      (nextOpen: boolean) => {
        if (disabled) return;
        setOpen(nextOpen);
      },
      [disabled]
    );

    const handleClear = React.useCallback(() => {
      onChange('');
      setOpen(false);
    }, [onChange]);

    return (
      <div className={cn('space-y-2', containerClassName)}>
        {label ? (
          <label className="text-sm font-medium leading-none">
            {label}
            {required ? <span className="ml-1 text-destructive">*</span> : null}
          </label>
        ) : null}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              variant="outline"
              type="button"
              disabled={disabled}
              className={cn(
                'w-full justify-start gap-2 rounded-xl border border-border/60 bg-background text-left font-normal shadow-sm hover:bg-muted/50',
                !parsedDate && 'text-muted-foreground',
                className
              )}
              {...buttonProps}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {displayLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto rounded-3xl border border-border/50 p-0 shadow-2xl" align="start" sideOffset={8}>
            <Calendar
              mode="single"
              selected={parsedDate}
              defaultMonth={parsedDate ?? defaultMonth}
              onSelect={handleSelect}
              disabled={disabled}
              locale={zhCN}
              weekStartsOn={1}
              initialFocus
            />
            <div className="flex gap-2 border-t px-3 py-2">
              <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => handleSelect(new Date())}>
                今天
              </Button>
              {clearable && value ? (
                <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={handleClear}>
                  清除
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
