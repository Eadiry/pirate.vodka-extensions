import type { SearchResultItem } from "@paperback/types";
import { ContentRating } from "@paperback/types";
import type { SearchFilter, SearchFilterValue } from "@paperback/types/lib/compat/0.8";
import type { VortexGenre, VortexQueryResponse } from "../shared/models";
import { buildMangaId } from "../shared/utils";

type DropdownOption = { id: string; value: string };

export function readDropdownFilter(
  filters: SearchFilterValue[],
  filterId: string,
  fallback: string,
): string {
  const entry = filters.find((filter) => filter.id === filterId);
  if (!entry) return fallback;

  const value = entry.value;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function readMultiselectFilter(filters: SearchFilterValue[], filterId: string): string[] {
  const entry = filters.find((filter) => filter.id === filterId);
  if (!entry) return [];

  const value = entry.value;
  if (typeof value === "string") return [];

  return Object.entries(value)
    .filter(([, state]) => state === "included")
    .map(([id]) => id);
}

export function readExcludedMultiselectFilter(
  filters: SearchFilterValue[],
  filterId: string,
): string[] {
  const entry = filters.find((filter) => filter.id === filterId);
  if (!entry) return [];

  const value = entry.value;
  if (typeof value === "string") return [];

  return Object.entries(value)
    .filter(([, state]) => state === "excluded")
    .map(([id]) => id);
}

export function buildSearchFilters(
  genres: VortexGenre[],
  statusOptions: DropdownOption[],
  typeOptions: DropdownOption[],
): SearchFilter[] {
  return [
    {
      type: "dropdown",
      id: "status",
      title: "Status",
      options: statusOptions,
      value: "",
    },
    {
      type: "dropdown",
      id: "type",
      title: "Type",
      options: typeOptions,
      value: "",
    },
    {
      type: "multiselect",
      id: "genres",
      title: "Genres",
      options: genres
        .filter((genre) => genre.name !== "hidden")
        .map((genre) => ({
          id: genre.id.toString(),
          value: genre.name,
        })),
      value: {},
      allowExclusion: true,
      allowEmptySelection: true,
      maximum: undefined,
    },
  ];
}

export function parseSearchResults(data: VortexQueryResponse): SearchResultItem[] {
  return (data.posts ?? [])
    .filter((post) => post.postTitle && post.postTitle.trim().length > 0 && !post.isNovel)
    .map((post) => {
      const mangaId = buildMangaId(post.id, post.slug);
      const latestChapter = post.chapters?.[0];

      return {
        mangaId,
        title: Application.decodeHTMLEntities(post.postTitle),
        imageUrl: post.featuredImage || "",
        subtitle: `${latestChapter?.number ?? post._count?.chapters ?? 0} Chapters`,
        contentRating: ContentRating.EVERYONE,
      };
    });
}
