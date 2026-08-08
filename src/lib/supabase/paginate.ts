type RangeQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * PostgREST caps every response at a server-configured max row count (1000 on this project)
 * regardless of the Range requested by the client. Queries expected to return more than that
 * many rows must page through with .range() until a short page signals the end.
 */
export async function fetchAllRows<T>(buildQuery: RangeQuery<T>, pageSize = 1000): Promise<T[]> {
  const results: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    results.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return results
}
