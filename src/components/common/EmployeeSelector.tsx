'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

type Employee = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  employeeCode: string | null;
  department: string | null;
  email: string;
};

type EmployeeSelectorProps = {
  value?: string; // selected employee id
  onChange: (employeeId: string | null, employee: Employee | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
};

export default function EmployeeSelector({
  value,
  onChange,
  placeholder = '选择员工',
  disabled = false,
  className = '',
  label,
  required = false,
}: EmployeeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch employees list
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pageSize: '100' });
        if (search) params.set('search', search);
        
        const response = await fetch(`/api/employees?${params.toString()}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setEmployees(result.data.items || []);
          }
        }
      } catch (error) {
        console.error('加载员工列表失败', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen, search]);

  // Fetch selected employee details
  useEffect(() => {
    if (value && !selectedEmployee) {
      const fetchEmployee = async () => {
        try {
          const response = await fetch(`/api/employees/${value}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setSelectedEmployee(result.data);
            }
          }
        } catch (error) {
          console.error('加载员工信息失败', error);
        }
      };
      fetchEmployee();
    }
  }, [value, selectedEmployee]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    onChange(employee.id, employee);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmployee(null);
    onChange(null, null);
  };

  const getInitials = (name: string) => {
    const chars = name.trim().slice(0, 2);
    return /^[A-Za-z]+$/.test(chars) ? chars.toUpperCase() : chars;
  };

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      
      <div ref={containerRef} className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-left text-sm shadow-theme-xs transition-colors focus:outline-hidden focus:ring-3 ${
            disabled
              ? 'cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800'
              : 'border-gray-300 text-gray-800 hover:border-gray-400 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:hover:border-gray-600 dark:focus:border-brand-800'
          }`}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedEmployee ? (
              <>
                {selectedEmployee.avatarUrl ? (
                  <Image
                    src={selectedEmployee.avatarUrl}
                    alt={selectedEmployee.displayName}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {getInitials(selectedEmployee.displayName)}
                  </div>
                )}
                <span className="truncate">{selectedEmployee.displayName}</span>
                {selectedEmployee.department && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({selectedEmployee.department})
                  </span>
                )}
              </>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {selectedEmployee && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg
              className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {/* Search */}
            <div className="border-b border-gray-200 p-2 dark:border-gray-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索员工..."
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white/90"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                  加载中...
                </div>
              ) : employees.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                  暂无员工
                </div>
              ) : (
                employees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => handleSelect(employee)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      value === employee.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                    }`}
                  >
                    {employee.avatarUrl ? (
                      <Image
                        src={employee.avatarUrl}
                        alt={employee.displayName}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                        {getInitials(employee.displayName)}
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate font-medium text-gray-900 dark:text-white">
                        {employee.displayName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {employee.employeeCode && <span>{employee.employeeCode}</span>}
                        {employee.department && (
                          <>
                            {employee.employeeCode && <span>•</span>}
                            <span>{employee.department}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {value === employee.id && (
                      <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
