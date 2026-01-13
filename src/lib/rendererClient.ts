export interface RenderRequest {
  url: string;
  timeoutMs?: number;
  fullPage?: boolean;
  waitForNetworkIdleMs?: number;
  headers?: Record<string, string>;
}

export interface RenderResponse {
  status: number;
  finalUrl: string;
  html?: string;
  contentLength?: number;
  screenshotBase64?: string;
  error?: string;
}

export type RenderFetcher = typeof fetch;

export async function renderPage(
  renderServiceUrl: string,
  request: RenderRequest,
  fetcher: RenderFetcher = fetch
): Promise<RenderResponse> {
  const headers = { "Content-Type": "application/json", ...(request.headers ?? {}) };

  const response = await fetcher(`${renderServiceUrl.replace(/\/$/, "")}/render`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      status: response.status,
      finalUrl: request.url,
      error: data?.error || `Renderer error ${response.status}`,
    };
  }

  return {
    status: data?.status ?? response.status,
    finalUrl: data?.finalUrl || request.url,
    html: data?.html,
    contentLength: data?.contentLength,
    screenshotBase64: data?.screenshotBase64,
    error: data?.error,
  };
}
