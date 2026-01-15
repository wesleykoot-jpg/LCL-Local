export function parseToISODate(dateStr: string, today?: Date): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  const todayDate = today ? new Date(today) : new Date();
  const safeYear = (year: number) => year >= 2020 && year <= 2030;
  const cleaned = dateStr.trim().toLowerCase();
  if (!cleaned) return null;

  const relativeMap: Record<string, number> = { vandaag: 0, today: 0, morgen: 1, tomorrow: 1, overmorgen: 2, "day after tomorrow": 2 };
  if (relativeMap[cleaned] !== undefined) {
    const target = new Date(todayDate);
    target.setDate(target.getDate() + relativeMap[cleaned]);
    return target.toISOString().split("T")[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-").map(Number);
    if (safeYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) return cleaned;
    return null;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[tT]/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    if (!safeYear(year)) return null;
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const MONTHS: Record<string, number> = {
    januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, februar: 2,
    maart: 3, mrt: 3, march: 3, märz: 3, maerz: 3, april: 4, apr: 4,
    mei: 5, may: 5, mai: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
    augustus: 8, aug: 8, august: 8, september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, october: 10, november: 11, nov: 11, december: 12, dec: 12,
  };

  const textual = cleaned.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const dayNamePattern = "(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?";
  const textualMatch = textual.match(new RegExp(`^${dayNamePattern}\\s*(\\d{1,2})\\s*([\\p{L}.]+)\\s*(\\d{2,4})?$`, "iu"));
  if (textualMatch) {
    const day = parseInt(textualMatch[2], 10);
    const monthNameRaw = textualMatch[3].replace(/\./g, "");
    const yearMatch = textualMatch[4] ? parseInt(textualMatch[4], 10) : todayDate.getFullYear();
    const month = MONTHS[monthNameRaw] || MONTHS[monthNameRaw.slice(0, 3)];
    if (month && day >= 1 && day <= 31 && safeYear(yearMatch)) {
      return `${yearMatch}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const europeanMatch = textual.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (europeanMatch) {
    const [, dayRaw, monthRaw, yearRaw] = europeanMatch;
    const centuryPrefix = String(todayDate.getFullYear()).slice(0, 2);
    const yearNum = parseInt(yearRaw.length === 2 ? `${centuryPrefix}${yearRaw}` : yearRaw, 10);
    if (!safeYear(yearNum)) return null;
    return `${yearNum}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}`;
  }

  return null;
}