import { z } from 'zod';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export function parsePagination(params: { page?: string | number; pageSize?: string | number }) {
  return paginationSchema.parse(params);
}

export function selectPage<T>(rows: T[], page = 1, pageSize = 50): PageResult<T> {
  const parsed = parsePagination({ page, pageSize });
  const currentPage = Math.min(parsed.page, Math.max(1, Math.ceil(rows.length / parsed.pageSize)));
  return { items: rows.slice((currentPage - 1) * parsed.pageSize, currentPage * parsed.pageSize), total: rows.length, ...parsed, page: currentPage };
}
