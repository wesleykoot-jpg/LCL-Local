export function normalizeAndResolveUrl(
  href: string,
  baseUrl: string,
  stripTracking: boolean = true
): string {
  const resolved = new URL(href, baseUrl);
  resolved.hash = "";

  if (stripTracking) {
    const params = resolved.searchParams;
    const trackingKeys: string[] = [];
    for (const key of params.keys()) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid") {
        trackingKeys.push(key);
      }
    }
    trackingKeys.forEach((key) => params.delete(key));
  }

  return resolved.toString();
}

export type ProbeResult = {
  candidate: string;
  status: number;
  finalUrl: string;
  ok: boolean;
};

export async function probePaths(
  baseUrl: string,
  paths: string[],
  fetcher: typeof fetch = fetch,
  timeoutMs: number = 4000
): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  for (const path of paths) {
    const target = normalizeAndResolveUrl(path, baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | null = null;

    try {
      try {
        response = await fetcher(target, { method: "HEAD", signal: controller.signal });
      } catch {
        response = null;
      }

      if (!response || response.status >= 400) {
        response = await fetcher(target, { method: "GET", signal: controller.signal });
      }

      results.push({
        candidate: target,
        status: response.status,
        finalUrl: response.url || target,
        ok: response.ok,
      });
    } catch (error) {
      results.push({
        candidate: target,
        status: 0,
        finalUrl: target,
        ok: false,
      });
      console.warn(`Probe failed for ${target}: ${error instanceof Error ? error.message : error}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return results;
}
