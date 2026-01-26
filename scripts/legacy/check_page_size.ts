import * as cheerio from "npm:cheerio@1.0.0-rc.12";

async function checkPageSize() {
  const url = "https://www.visitzwolle.com/wat-te-doen/uitgaan/";
  console.log(`Fetching ${url}...`);

  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const html = await resp.text();
  const $ = cheerio.load(html);

  // Try to find the grid/list items
  // Common for this custom site? Let's check generally generic items
  const potentialItems = $(
    "article, .item, .card, .event, li > a[href*='agenda'], li > a[href*='activiteiten']",
  );

  console.log(`\n--- PAGE ANALYSIS ---`);
  console.log(`Total HTML Size: ${(html.length / 1024).toFixed(2)} KB`);
  console.log(
    `Potential Visual Items found on Page 1: ${potentialItems.length}`,
  );

  // Look for pagination
  const pagination = $(".pagination, .pager, [class*='pagination']");
  console.log(`Pagination detected? ${pagination.length > 0 ? "YES" : "NO"}`);
}

checkPageSize();
