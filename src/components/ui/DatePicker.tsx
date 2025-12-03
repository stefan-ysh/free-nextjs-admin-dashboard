'use client';

import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
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

const DISPLAY_FORMAT = "yyyy年MM月dd日 EEEE";
const OUTPUT_FORMAT = 'yyyy-MM-dd';

function parseValue(value?: string | null) {
  if (!value) return undefined;
  try {
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
    const displayLabel = parsedDate ? format(parsedDate, DISPLAY_FORMAT, { locale: zhCN }) : placeholder;

    const handleSelect = React.useCallback(
      (date?: Date) => {
        if (!date) return;
        onChange(format(date, OUTPUT_FORMAT));
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
