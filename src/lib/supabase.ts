// Helper for Vercel serverless functions to call Supabase REST API

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

interface SupabaseQueryOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  filters?: string;
  select?: string;
  single?: boolean;
  upsert?: boolean;
  order?: string;
}

export async function supabaseQuery<T = unknown>(
  table: string,
  options: SupabaseQueryOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  const {
    method = 'GET',
    body,
    filters,
    select,
    single = false,
    upsert = false,
    order,
  } = options;

  const params = new URLSearchParams();
  if (select) params.set('select', select);
  if (filters) {
    // filters is a raw PostgREST query string like "status=eq.active&category=eq.software"
    const filterParts = filters.split('&');
    for (const part of filterParts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        params.append(part.slice(0, eqIdx), part.slice(eqIdx + 1));
      }
    }
  }
  if (order) params.set('order', order);

  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;

  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (method === 'POST' || method === 'PATCH') {
    const preferParts: string[] = ['return=representation'];
    if (upsert) preferParts.push('resolution=merge-duplicates');
    headers['Prefer'] = preferParts.join(',');
  }

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Supabase ${method} ${table} error:`, response.status, errorText);
      return { data: null, error: `Supabase error ${response.status}: ${errorText}` };
    }

    if (method === 'DELETE' && response.status === 204) {
      return { data: null, error: null };
    }

    const data = await response.json() as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Supabase ${method} ${table} fetch error:`, message);
    return { data: null, error: message };
  }
}
