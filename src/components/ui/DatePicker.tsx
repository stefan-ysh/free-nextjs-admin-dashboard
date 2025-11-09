'use client';

import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export default function DatePicker({
  value,
  onChange,
  label,
  required = false,
  placeholder = '选择日期',
  className = '',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const handleDateSelect = (day: number) => {
    const selected = new Date(year, month, day);
    const dateString = selected.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    );
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const selectedDate = new Date(value + 'T00:00:00');
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    );
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div ref={containerRef} className="relative">
        {/* 输入框 */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <span className={value ? '' : 'text-gray-400 dark:text-gray-500'}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <svg
            className="h-5 w-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* 日历面板 */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-gray-800">
            {/* 月份导航 */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <span className="font-semibold text-gray-900 dark:text-white">
                {year}年{month + 1}月
              </span>

              <button
                type="button"
                onClick={nextMonth}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* 星期标题 */}
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
              <div>日</div>
              <div>一</div>
              <div>二</div>
              <div>三</div>
              <div>四</div>
              <div>五</div>
              <div>六</div>
            </div>

            {/* 日期网格 */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`
                      rounded-lg p-2 text-sm
                      ${isSelected(day)
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : isToday(day)
                        ? 'border border-blue-500 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* 今天按钮 */}
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                onChange(today);
                setIsOpen(false);
              }}
              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              今天
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
