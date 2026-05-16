import {
  DISCOVER_SECTIONS,
  DOMAIN,
  DOMAIN_ALT,
  DOMAIN_IMAGE,
  DOMAIN_IMAGE_PROXY,
  SEARCH_GENRE_OPTIONS,
  type DomainMode,
  type DiscoverSectionDefinition,
  type SearchGenreOption,
} from "./models";
import { DOMAIN_MODE_KEY, USE_BACKUP_DOMAIN_FALLBACK_KEY } from "../settings-form-providing/models";

export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null),
      );
    });
  });
}

export function getDiscoverSectionDefinition(
  sectionId: string,
): DiscoverSectionDefinition | undefined {
  return DISCOVER_SECTIONS.find((section) => section.id === sectionId);
}

export function getSearchGenreOption(genreId: string): SearchGenreOption | undefined {
  return SEARCH_GENRE_OPTIONS.find((genre) => genre.id === genreId);
}

export function getDomainMode(): DomainMode {
  return Application.getState(DOMAIN_MODE_KEY) === "backup" ? "backup" : "main";
}

export function setDomainMode(value: string): void {
  Application.setState(value === "backup" ? "backup" : "main", DOMAIN_MODE_KEY);
}

export function getUseBackupDomainFallback(): boolean {
  return (Application.getState(USE_BACKUP_DOMAIN_FALLBACK_KEY) as boolean | undefined) ?? false;
}

export function setUseBackupDomainFallback(value: boolean): void {
  Application.setState(value, USE_BACKUP_DOMAIN_FALLBACK_KEY);
}

export function getReadComicOnlineDomain(): string {
  return getDomainMode() === "backup" ? DOMAIN_ALT : DOMAIN;
}

export function getReadComicOnlineDomainForUrl(url: string): string {
  if (isReadComicOnlineDomainUrl(url, DOMAIN_ALT)) return DOMAIN_ALT;
  if (isReadComicOnlineDomainUrl(url, DOMAIN)) return DOMAIN;
  return getReadComicOnlineDomain();
}

export function rewriteToPreferredReadComicOnlineDomain(url: string): string {
  if (getDomainMode() === "backup" && isReadComicOnlineDomainUrl(url, DOMAIN)) {
    return `${DOMAIN_ALT}${url.slice(DOMAIN.length)}`;
  }

  return url;
}

export function rewriteToBackupReadComicOnlineDomain(url: string): string {
  if (isReadComicOnlineDomainUrl(url, DOMAIN)) {
    return `${DOMAIN_ALT}${url.slice(DOMAIN.length)}`;
  }

  return url;
}

export function shouldRetryReadComicOnlineBackup(url: string): boolean {
  return (
    getDomainMode() === "main" &&
    getUseBackupDomainFallback() &&
    isReadComicOnlineDomainUrl(url, DOMAIN)
  );
}

function isReadComicOnlineDomainUrl(url: string, domain: string): boolean {
  return url === domain || url.startsWith(`${domain}/`);
}

// reimplements rguard beau() image URL decoding
// source: https://readcomiconline.li/Scripts/rguard.min.js?v=1.5.8
// strips anti-scraping padding, decodes the cdn path, then restores auth params
export function beauDecode(url: string): string | null {
  // rguard hardcoded replacements
  url = url.replace(/pw_.g28x/g, "b").replace(/d2pr.x_27/g, "h");

  // already decoded after replacements
  if (url.indexOf("https") === 0) return url;

  // split auth query params before path cleanup
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return null;
  const queryParams = url.substring(qIdx);

  // detect image quality suffix before path cleanup
  const isS0 = url.indexOf("=s0?") > 0;
  let path: string;
  if (isS0) {
    path = url.substring(0, url.indexOf("=s0?"));
  } else {
    const idx = url.indexOf("=s1600?");
    if (idx < 0) return null;
    path = url.substring(0, idx);
  }

  // strip 15-byte prefix and 17-byte middle padding
  path = path.substring(15, 33) + path.substring(50);

  // strip 9-byte padding before the final 2 chars
  path = path.substring(0, path.length - 11) + path[path.length - 2] + path[path.length - 1];

  // decode real cdn path
  const decoded = Application.base64Decode(path);
  const decodedPath =
    typeof decoded === "string" ? decoded : Application.arrayBufferToUTF8String(decoded);

  // strip 4-byte decoded path padding at position 13
  let result = decodedPath.substring(0, 13) + decodedPath.substring(17);

  // restore size suffix
  result = result.substring(0, result.length - 2) + (isS0 ? "=s0" : "=s1600");

  // rguard proxies ip= image urls through ano1 before assigning img src
  const host = queryParams.includes("ip=") ? DOMAIN_IMAGE_PROXY : DOMAIN_IMAGE;
  const imagePath = result.startsWith("/") ? result : `/${result}`;

  return host + imagePath + queryParams;
}
