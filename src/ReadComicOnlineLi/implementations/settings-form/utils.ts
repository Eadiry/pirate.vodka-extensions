import { DEFAULT_DISCOVER_SECTION_IDS, DEFAULT_SEARCH_GENRE_IDS } from "../shared/models";

export function normalizeDiscoverSectionIds(value: unknown, includeMissing: boolean): string[] {
  return normalizeSettingIds(value, DEFAULT_DISCOVER_SECTION_IDS, includeMissing);
}

export function normalizeSearchGenreIds(value: unknown, includeMissing: boolean): string[] {
  return normalizeSettingIds(value, DEFAULT_SEARCH_GENRE_IDS, includeMissing);
}

function normalizeSettingIds(
  value: unknown,
  knownIds: string[],
  includeMissing: boolean,
): string[] {
  const knownIdSet = new Set(knownIds);
  const normalizedIds: string[] = [];

  if (Array.isArray(value)) {
    for (const id of value) {
      if (typeof id === "string" && knownIdSet.has(id) && !normalizedIds.includes(id)) {
        normalizedIds.push(id);
      }
    }
  }

  if (includeMissing) {
    for (const id of knownIds) {
      if (!normalizedIds.includes(id)) {
        normalizedIds.push(id);
      }
    }
  }

  return normalizedIds;
}
