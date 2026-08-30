/** Typed API client (U0): JWT attach, refresh-once-on-401, RFC-7807 problem parsing. */

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    readonly status: number,
  ) {
    super(problem.title || `HTTP ${status}`);
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  /** returns the current access token (from cookie/store) */
  getToken: () => string | null;
  /** called once when a 401 arrives; if it returns a new token the request is retried */
  refresh: () => Promise<string | null>;
  /** extra headers per request (e.g. x-tenant-id in dev) */
  extraHeaders?: () => Record<string, string>;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  private async request<T>(method: string, path: string, body?: unknown, retry = true, tokenOverride?: string): Promise<T> {
    const token = tokenOverride ?? this.opts.getToken();
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...this.opts.extraHeaders?.(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && retry) {
      const newToken = await this.opts.refresh();
      if (newToken) {
        return this.request<T>(method, path, body, false, newToken);
      }
    }

    if (!res.ok) {
      const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
      throw new ApiError(
        problem ?? { title: res.statusText || "Request failed", status: res.status },
        res.status,
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }
  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
