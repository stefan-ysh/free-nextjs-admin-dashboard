'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Project = {
  id: string;
  projectCode: string;
  projectName: string;
  department: string | null;
  budget: number | null;
  status: string;
};

type ProjectSelectorProps = {
  value?: string | null;
  onChange: (projectId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  required?: boolean;
};

export default function ProjectSelector({
  value,
  onChange,
  placeholder = '选择项目',
  disabled = false,
  label,
  required = false,
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchProjects = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '100',
        status: 'active', // Only show active projects
      });

      if (query.trim()) {
        params.append('search', query.trim());
      }

      const response = await fetch(`/api/projects?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setProjects(result.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch projects with search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchProjects(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, search, fetchProjects]);

  // Fetch selected project details
  const fetchProjectById = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSelectedProject(result.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch project', error);
    }
  }, []);

  useEffect(() => {
    if (value) {
      if (!selectedProject || selectedProject.id !== value) {
        fetchProjectById(value);
      }
    } else if (selectedProject) {
      setSelectedProject(null);
    }
  }, [value, selectedProject, fetchProjectById]);

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

  

  const handleSelect = useCallback(
    (project: Project) => {
      setSelectedProject(project);
      onChange(project.id);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedProject(null);
      onChange(null);
      setSearch('');
    },
    [onChange]
  );

  const filteredProjects = projects.filter((project) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      project.projectCode.toLowerCase().includes(searchLower) ||
      project.projectName.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      
      <div ref={containerRef} className="relative">
        {/* Selector Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            relative w-full rounded-lg border bg-white px-4 py-2.5 text-left transition-all
            ${disabled 
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800' 
              : 'cursor-pointer border-gray-300 hover:border-brand-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-brand-500'
            }
            ${isOpen ? 'border-brand-500 ring-2 ring-brand-100 dark:border-brand-400 dark:ring-brand-900/30' : ''}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 truncate">
              {selectedProject ? (
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                    {selectedProject.projectCode}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {selectedProject.projectName}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  {placeholder}
                </span>
              )}
            </div>
            <div className="ml-2 flex items-center gap-1">
              {selectedProject && !disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
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
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {/* Search */}
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索项目编号或名称..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 dark:focus:border-brand-400 dark:focus:ring-brand-900/30"
                autoFocus
              />
            </div>

            {/* Project List */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {search.trim() ? '未找到匹配的项目' : '暂无项目'}
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelect(project)}
                    className={`
                      flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0
                      hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50
                      ${selectedProject?.id === project.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}
                    `}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                          {project.projectCode}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {project.projectName}
                        </span>
                      </div>
                      {project.department && (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {project.department}
                        </div>
                      )}
                    </div>
                    {selectedProject?.id === project.id && (
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
