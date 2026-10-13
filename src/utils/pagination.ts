export function appliedSort(
  sort: string | undefined,
  fallback: string,
  order: 'asc' | 'desc' | undefined,
  fallbackOrder: 'asc' | 'desc' = 'desc',
) {
  return { sort: sort ?? fallback, order: order ?? fallbackOrder };
}

export function getPagination(page: number, limit: number): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function pageMeta(
  page: number,
  limit: number,
  total: number,
  sort?: { sort: string; order: 'asc' | 'desc' },
) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    ...(sort ? { sort: sort.sort, order: sort.order } : {}),
  };
}
