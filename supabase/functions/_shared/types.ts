export interface RawEventCard {
  title: string;
  date: string;
  location: string;
  description: string;
  detailUrl: string;
  imageUrl: string | null;
  rawHtml: string;
  categoryHint?: string;
  detailPageTime?: string;
}

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  requires_render?: boolean;
  last_probe_urls?: Record<string, unknown>;
  language?: string;
  country?: string;
  default_coordinates?: { lat: number; lng: number };
  config: {
    selectors?: string[];
    headers?: Record<string, string>;
    rate_limit_ms?: number;
    default_coordinates?: { lat: number; lng: number };
    language?: string;
    country?: string;
    dynamic_year?: boolean;
    discoveryAnchors?: string[];
    alternatePaths?: string[];
    requires_render?: boolean;
  };
}