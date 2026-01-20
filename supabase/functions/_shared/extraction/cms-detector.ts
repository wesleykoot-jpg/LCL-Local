
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

export type DetectedCMS = "wordpress" | "nextjs" | "nuxt" | "wix" | "squarespace" | "drupal" | "joomla" | "unknown";

export function detectCMS(html: string): DetectedCMS {
  const $ = cheerio.load(html);

  // 1. Meta generator
  const generator = $('meta[name="generator"]').attr("content")?.toLowerCase() || "";
  if (generator.includes("wordpress")) return "wordpress";
  if (generator.includes("drupal")) return "drupal";
  if (generator.includes("joomla")) return "joomla";
  if (generator.includes("wix")) return "wix";
  if (generator.includes("squarespace")) return "squarespace";

  // 2. Script patterns
  if (html.includes("/wp-content/") || html.includes("/wp-includes/")) return "wordpress";
  if (html.includes("_next/static")) return "nextjs";
  if (html.includes("_nuxt/")) return "nuxt";

  // 3. Headers/Body classes (optional, but body classes are available in $)
  const bodyClass = $("body").attr("class") || "";
  if (bodyClass.includes("page-template-default") || bodyClass.includes("wp-custom-logo")) return "wordpress";

  return "unknown";
}
