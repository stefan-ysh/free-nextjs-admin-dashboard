import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('utils', () => {
    describe('cn', () => {
        it('should merge class names correctly', () => {
            expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500');
        });

        it('should handle conditional classes', () => {
            expect(cn('text-red-500', false && 'bg-blue-500', 'p-4')).toBe('text-red-500 p-4');
        });

        it('should merge tailwind classes properly (conflict resolution)', () => {
            // p-4 (padding: 1rem) should be overridden by p-8 (padding: 2rem) if it comes later?
            // tailwind-merge handles this.
            expect(cn('p-4', 'p-8')).toBe('p-8');
        });
    });
});
