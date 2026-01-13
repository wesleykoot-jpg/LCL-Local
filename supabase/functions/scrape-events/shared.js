"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HEADERS = void 0;
exports.fetchEventDetailTime = fetchEventDetailTime;
const cheerio = __importStar(require("npm:cheerio@1.0.0-rc.12"));
exports.DEFAULT_HEADERS = {
    "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};
function normalizeMatchedTime(hours, minutes, ampm) {
    let hourNum = parseInt(hours, 10);
    if (ampm) {
        const lower = ampm.toLowerCase();
        if (lower === "pm" && hourNum < 12)
            hourNum += 12;
        if (lower === "am" && hourNum === 12)
            hourNum = 0;
    }
    if (hourNum > 23)
        return null;
    return `${String(hourNum).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}
async function fetchEventDetailTime(detailUrl, baseUrl, fetcher = fetch) {
    try {
        let fullUrl = detailUrl;
        if (detailUrl.startsWith("/")) {
            const urlObj = new URL(baseUrl);
            fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
        }
        else if (!detailUrl.startsWith("http")) {
            fullUrl = `${baseUrl.replace(/\/$/, "")}/${detailUrl}`;
        }
        const response = await fetcher(fullUrl, {
            headers: exports.DEFAULT_HEADERS,
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            return null;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const pageText = $("body").text();
        const timePatterns = [
            /aanvang[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /vanaf\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /(\d{1,2})[.:h](\d{2})\s*uur/i,
            /beginn[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /ab\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /(\d{1,2})[.:h](\d{2})\s*uhr/i,
            /starts?\s*(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /from\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /doors?\s*(?:open\s*)?(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /time[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /om\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
            /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}(?:\s*(am|pm))?/i,
        ];
        const timeElements = [
            ".event-time",
            ".time",
            '[class*="time"]',
            '[class*="tijd"]',
            ".event-details",
            ".details",
            'meta[property="event:start_time"]',
            ".aanvang",
            '[class*="aanvang"]',
            ".beginn",
            '[class*="beginn"]',
        ];
        for (const selector of timeElements) {
            const el = $(selector);
            if (el.length > 0) {
                const elText = el.text() || el.attr("content") || "";
                for (const pattern of timePatterns) {
                    const match = elText.match(pattern);
                    if (match) {
                        const time = normalizeMatchedTime(match[1], match[2], match[3]);
                        if (time) {
                            return time;
                        }
                    }
                }
            }
        }
        for (const pattern of timePatterns) {
            const match = pageText.match(pattern);
            if (match) {
                const time = normalizeMatchedTime(match[1], match[2], match[3]);
                if (time) {
                    return time;
                }
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
