const THEMES = [
  { key: "solar", match: ["solar", "панел", "инверт", "аккум", "монтаж", "roof", "lifepo4"], bg: ["#FFF3C4", "#FFD56B"], accent: "#1B7A32", shape: "panel" },
  { key: "tech", match: ["smart", "ноут", "laptop", "смартф", "watch", "науш", "gadget", "tech"], bg: ["#DCE9FF", "#9FC0FF"], accent: "#1F4FD8", shape: "device" },
  { key: "fashion", match: ["пальто", "футбол", "сумк", "брюк", "одеж", "fashion", "dress", "coat", "shirt"], bg: ["#FFE0D8", "#FFC3AF"], accent: "#8B3D2F", shape: "hanger" },
  { key: "beauty", match: ["сывор", "крем", "духи", "помад", "beauty", "cosmetic", "масло"], bg: ["#FBE0F0", "#F6B8D6"], accent: "#B43C73", shape: "bottle" },
  { key: "sport", match: ["бегов", "кроссов", "гантел", "йог", "sport", "running", "fitness"], bg: ["#E2F8D8", "#B9E78B"], accent: "#357A1F", shape: "shoe" },
  { key: "book", match: ["книг", "book", "том", "сказк", "литерат"], bg: ["#F2E4CF", "#DDBD92"], accent: "#7A4A12", shape: "book" },
  { key: "home", match: ["диван", "ваза", "плед", "стол", "интерьер", "home", "decor"], bg: ["#ECE4D8", "#D2B99C"], accent: "#705337", shape: "chair" },
  { key: "pet", match: ["собак", "корм", "кот", "повод", "pet", "dog", "cat"], bg: ["#FFEAC4", "#FFD18A"], accent: "#9B5D0A", shape: "paw" },
  { key: "music", match: ["гитар", "синтез", "струн", "music", "fender", "yamaha"], bg: ["#E4D7FF", "#BEA2FF"], accent: "#5F32AD", shape: "music" },
  { key: "food", match: ["кофе", "сыр", "шокол", "чай", "food", "арабика"], bg: ["#F7E2C9", "#D9AE73"], accent: "#8A4F17", shape: "cup" },
  { key: "auto", match: ["авто", "масло", "automotive", "motor"], bg: ["#DCE3EA", "#A8B6C3"], accent: "#2B3E50", shape: "wheel" },
  { key: "default", match: [], bg: ["#E8EEF6", "#C8D6EA"], accent: "#335D8D", shape: "box" }
];

type ImageContext = {
  title: string;
  category?: string;
  niche?: string;
  subtitle?: string;
};

export function getMockProductImage({
  title,
  category,
  niche,
  subtitle
}: ImageContext): string {
  const haystack = `${title} ${category ?? ""} ${niche ?? ""}`.toLowerCase();
  const theme =
    THEMES.find((entry) => entry.match.some((token) => haystack.includes(token))) ??
    THEMES[THEMES.length - 1];

  const label = escapeSvgText(truncate(title, 26));
  const sublabel = escapeSvgText(truncate(subtitle || category || niche || "Mock product", 28));

  const art = getShape(theme.shape, theme.accent);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" fill="none">
      <defs>
        <linearGradient id="bg" x1="160" y1="120" x2="1040" y2="1080" gradientUnits="userSpaceOnUse">
          <stop stop-color="${theme.bg[0]}"/>
          <stop offset="1" stop-color="${theme.bg[1]}"/>
        </linearGradient>
        <filter id="shadow" x="0" y="0" width="1200" height="1200" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="30" stdDeviation="40" flood-color="rgba(15,23,42,0.18)"/>
        </filter>
      </defs>
      <rect width="1200" height="1200" rx="0" fill="url(#bg)"/>
      <circle cx="1030" cy="170" r="170" fill="white" fill-opacity="0.26"/>
      <circle cx="180" cy="1040" r="220" fill="white" fill-opacity="0.18"/>
      <rect x="86" y="84" width="1028" height="1032" rx="44" fill="white" fill-opacity="0.8" stroke="white" stroke-opacity="0.7"/>
      <g filter="url(#shadow)">
        <rect x="160" y="160" width="880" height="620" rx="36" fill="#F9FBFD"/>
        <rect x="190" y="190" width="820" height="560" rx="28" fill="#FFFFFF"/>
        ${art}
      </g>
      <rect x="160" y="820" width="520" height="22" rx="11" fill="${theme.accent}" fill-opacity="0.18"/>
      <text x="160" y="915" fill="#0F172A" font-size="68" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>
      <text x="160" y="980" fill="#475569" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="500">${sublabel}</text>
      <rect x="160" y="1028" width="200" height="66" rx="33" fill="${theme.accent}" fill-opacity="0.12"/>
      <text x="198" y="1072" fill="${theme.accent}" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="700">Sun.store mock</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function normalizeMockImages<T extends { title?: string; title_ru?: string; category_name_ru?: string; images?: string[] }>(
  item: T,
  context?: { niche?: string; category?: string }
): T {
  const title = item.title_ru ?? item.title ?? "Mock product";
  const category = item.category_name_ru ?? context?.category;
  return {
    ...item,
    images: [getMockProductImage({ title, category, niche: context?.niche, subtitle: category })]
  };
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getShape(shape: string, accent: string): string {
  switch (shape) {
    case "panel":
      return `
        <rect x="360" y="254" width="480" height="320" rx="24" fill="#123047"/>
        <g stroke="#7FD1FF" stroke-width="10" opacity="0.9">
          <path d="M450 254V574"/><path d="M540 254V574"/><path d="M630 254V574"/><path d="M720 254V574"/>
          <path d="M360 334H840"/><path d="M360 414H840"/><path d="M360 494H840"/>
        </g>
        <path d="M470 620H730" stroke="#345D2E" stroke-width="22" stroke-linecap="round"/>
        <path d="M520 620L455 710" stroke="#345D2E" stroke-width="18" stroke-linecap="round"/>
        <path d="M680 620L745 710" stroke="#345D2E" stroke-width="18" stroke-linecap="round"/>
        <circle cx="860" cy="300" r="52" fill="${accent}" fill-opacity="0.18"/>
      `;
    case "device":
      return `
        <rect x="430" y="214" width="340" height="470" rx="42" fill="#101828"/>
        <rect x="452" y="246" width="296" height="390" rx="28" fill="url(#bg)" opacity="0.9"/>
        <circle cx="600" cy="660" r="24" fill="#D0D5DD"/>
        <rect x="272" y="680" width="656" height="36" rx="18" fill="#CBD5E1"/>
      `;
    case "hanger":
      return `
        <path d="M600 248c-40 0-72 28-72 64 0 16 8 29 19 39l-57 54c-20 19-10 53 18 53h184c28 0 38-34 18-53l-72-68c11-10 18-23 18-39 0-36-32-64-72-64z" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="18"/>
        <path d="M600 248c0-31 22-56 54-56" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
        <rect x="370" y="478" width="460" height="130" rx="40" fill="#fff" stroke="#CBD5E1" stroke-width="14"/>
      `;
    case "bottle":
      return `
        <rect x="500" y="242" width="200" height="92" rx="28" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="10"/>
        <rect x="420" y="320" width="360" height="330" rx="72" fill="#FFFFFF" stroke="${accent}" stroke-width="16"/>
        <circle cx="600" cy="486" r="88" fill="${accent}" fill-opacity="0.14"/>
        <circle cx="600" cy="486" r="42" fill="${accent}" fill-opacity="0.35"/>
      `;
    case "shoe":
      return `
        <path d="M310 600c70-24 130-70 182-142l88 16 58 90c18 27 48 44 80 44h104c44 0 74 29 74 66v28H304c-35 0-64-25-64-56 0-22 15-41 38-46l32-8z" fill="#fff" stroke="${accent}" stroke-width="16"/>
        <path d="M520 520h128" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
        <path d="M486 560h176" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
      `;
    case "book":
      return `
        <path d="M352 260h312c58 0 104 46 104 104v374H430c-43 0-78-35-78-78V260z" fill="#FFFFFF" stroke="${accent}" stroke-width="16"/>
        <path d="M768 260h72v478H502c-43 0-78 35-78 78h344V260z" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="16"/>
        <path d="M448 372h220M448 440h220M448 508h160" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
      `;
    case "chair":
      return `
        <rect x="400" y="318" width="400" height="220" rx="54" fill="#FFFFFF" stroke="${accent}" stroke-width="16"/>
        <rect x="380" y="528" width="440" height="120" rx="34" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="16"/>
        <path d="M456 650l-38 116M748 650l38 116" stroke="#6B7280" stroke-width="18" stroke-linecap="round"/>
      `;
    case "paw":
      return `
        <circle cx="600" cy="520" r="112" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="16"/>
        <circle cx="500" cy="376" r="54" fill="${accent}" fill-opacity="0.22"/>
        <circle cx="600" cy="334" r="54" fill="${accent}" fill-opacity="0.22"/>
        <circle cx="700" cy="376" r="54" fill="${accent}" fill-opacity="0.22"/>
        <circle cx="768" cy="470" r="54" fill="${accent}" fill-opacity="0.22"/>
      `;
    case "music":
      return `
        <path d="M690 278v266c-28-16-66-18-98-2-46 23-65 72-42 109 23 37 79 49 125 26 35-17 54-47 54-77V384l170-48v168c-28-16-66-18-98-2-46 23-65 72-42 109 23 37 79 49 125 26 35-17 54-47 54-77V240L690 278z" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="14"/>
      `;
    case "cup":
      return `
        <rect x="384" y="344" width="350" height="258" rx="42" fill="#FFFFFF" stroke="${accent}" stroke-width="16"/>
        <path d="M734 396h70c66 0 120 54 120 120s-54 120-120 120h-70" stroke="${accent}" stroke-width="16"/>
        <path d="M444 666c42 46 104 70 156 70s114-24 156-70" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
      `;
    case "wheel":
      return `
        <circle cx="600" cy="500" r="188" fill="#FFFFFF" stroke="${accent}" stroke-width="18"/>
        <circle cx="600" cy="500" r="88" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="16"/>
        <path d="M600 312v376M412 500h376M474 374l252 252M726 374L474 626" stroke="${accent}" stroke-width="14"/>
      `;
    default:
      return `
        <rect x="376" y="298" width="448" height="336" rx="44" fill="#FFFFFF" stroke="${accent}" stroke-width="16"/>
        <rect x="428" y="352" width="344" height="120" rx="20" fill="${accent}" fill-opacity="0.12"/>
        <rect x="428" y="500" width="270" height="26" rx="13" fill="#CBD5E1"/>
      `;
  }
}
