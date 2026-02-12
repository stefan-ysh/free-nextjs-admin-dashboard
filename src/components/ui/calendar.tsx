"use client";

import * as React from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import 'react-day-picker/style.css';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      className={cn('p-3', className)}
      classNames={{
        today: 'border-primary',
        selected: 'bg-primary text-primary-foreground rounded-md',
        root: `${defaultClassNames.root} rdp-custom`,
        chevron: `${defaultClassNames.chevron} fill-primary`,
        day_button: 'h-9 w-9 rounded-md text-sm font-normal cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:opacity-100',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        ...classNames,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';
