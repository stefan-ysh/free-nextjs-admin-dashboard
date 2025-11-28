'use client';

import { useState, useEffect } from 'react';
import { DepartmentOption, JobGradeOption } from './types';

type UseEmployeeOptionsProps = {
    initialDepartments?: DepartmentOption[];
    initialJobGrades?: JobGradeOption[];
};

export function useEmployeeOptions({
    initialDepartments,
    initialJobGrades,
}: UseEmployeeOptionsProps) {
    const [departments, setDepartments] = useState<DepartmentOption[]>(
        initialDepartments ?? []
    );
    const [jobGrades, setJobGrades] = useState<JobGradeOption[]>(
        initialJobGrades ?? []
    );

    // Sync if props change
    useEffect(() => {
        if (initialDepartments?.length) {
            setDepartments(initialDepartments);
        }
    }, [initialDepartments]);

    useEffect(() => {
        if (initialJobGrades?.length) {
            setJobGrades(initialJobGrades);
        }
    }, [initialJobGrades]);

    // Fetch if empty
    useEffect(() => {
        if (initialDepartments?.length) return;

        let cancelled = false;
        async function fetchDepartments() {
            try {
                const response = await fetch('/api/employees/departments');
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled && data.success && Array.isArray(data.data)) {
                    setDepartments(data.data);
                }
            } catch (error) {
                console.error('加载部门列表失败', error);
            }
        }
        fetchDepartments();
        return () => {
            cancelled = true;
        };
    }, [initialDepartments]);

    useEffect(() => {
        if (initialJobGrades?.length) return;

        let cancelled = false;
        async function fetchJobGrades() {
            try {
                const response = await fetch('/api/employees/job-grades');
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled && data.success && Array.isArray(data.data)) {
                    setJobGrades(data.data);
                }
            } catch (error) {
                console.error('加载职级列表失败', error);
            }
        }
        fetchJobGrades();
        return () => {
            cancelled = true;
        };
    }, [initialJobGrades]);

    return {
        departments,
        jobGrades,
    };
}
