import {
  AdvancedSearchForm,
  URL,
  type FormSectionElement,
  type PagedResults,
  type Request,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
} from "@paperback/types";
import {
  SearchFilterForm,
  type SearchFilter,
  type SearchFilterValue,
} from "@paperback/types/lib/compat/0.8";
import {
  DISCOVER_SECTION_SEARCH_METADATA_ID,
  DOMAIN,
  SORT_OPTIONS,
  type SearchGenreOption,
} from "../shared/models";
import { fetchCheerio } from "../../services/network";
import { parseDesktopTabItems } from "../discover-section-providing/parsers";
import {
  getDefaultSearchPage,
  getDefaultSearchSort,
  getHiddenSearchGenres,
  getSearchGenreOrder,
} from "../settings-form-providing/forms/main";
import { getDiscoverSectionDefinition, getSearchGenreOption } from "../shared/utils";
import {
  buildSearchFilters,
  parseHasNextPage,
  parseSearchResults,
  readDropdownFilter,
  readExcludedMultiselectFilter,
  readMultiselectFilter,
} from "./parsers";

export class SearchProvider {
  async getSearchFilters(): Promise<SearchFilter[]> {
    const request: Request = {
      url: new URL(DOMAIN).addPathComponent("AdvanceSearch").toString(),
      method: "GET",
    };
    const $ = await fetchCheerio(request);

    return buildSearchFilters($, getVisibleSearchGenreOptions());
  }

  getAdvancedSearchForm(query: SearchQuery<SearchFilterValue[]>): AdvancedSearchForm {
    const filters = query.metadata ?? [];
    if (readDiscoverSectionSearchId(filters)) {
      return new DiscoverSectionSearchForm(filters);
    }

    return new SearchFilterForm(filters, this.getSearchFilters());
  }

  async getSearchResults(
    query: SearchQuery<SearchFilterValue[]>,
    metadata?: { page?: number },
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    const discoverSectionId = readDiscoverSectionSearchId(query.metadata ?? []);
    if (discoverSectionId) {
      return getDiscoverSectionSearchResults(discoverSectionId, page);
    }

    const searchTerm = query.title?.trim() ?? "";
    const filters = query.metadata ?? [];
    const includedGenres = readMultiselectFilter(filters, "genres");
    const excludedGenres = readExcludedMultiselectFilter(filters, "genres");
    const status = sortingOption?.id ?? getDefaultSearchSort();
    const publicationYear = readDropdownFilter(filters, "publicationYear", "");
    const hasAdvancedSearchInput =
      searchTerm.length > 0 ||
      includedGenres.length > 0 ||
      excludedGenres.length > 0 ||
      publicationYear.length > 0 ||
      status.length > 0;

    if (!hasAdvancedSearchInput) {
      const request: Request = {
        url: buildDefaultSearchPageUrl(page),
        method: "GET",
      };
      const $ = await fetchCheerio(request);
      const items = parseSearchResults($);
      const hasMore = parseHasNextPage($);

      return {
        items,
        metadata: hasMore ? { page: page + 1 } : undefined,
      };
    }

    const items = await fetchAdvancedSearchResults({
      searchTerm,
      includedGenres,
      excludedGenres,
      status,
      publicationYear,
      page,
    });
    // advanced search returns 32 items while more pages exist
    const hasMore = items.length === 32;

    return {
      items,
      metadata: hasMore ? { page: page + 1 } : undefined,
    };
  }

  async getSortingOptions(query?: SearchQuery<SearchFilterValue[]>): Promise<SortingOption[]> {
    if (query && readDiscoverSectionSearchId(query.metadata ?? [])) {
      return [];
    }

    return SORT_OPTIONS;
  }
}

class DiscoverSectionSearchForm extends AdvancedSearchForm {
  constructor(private readonly filters: SearchFilterValue[]) {
    super();
  }

  override getSections(): FormSectionElement<unknown>[] {
    return [];
  }

  override getSearchQueryMetadata(): SearchFilterValue[] {
    return this.filters;
  }
}

async function getDiscoverSectionSearchResults(
  sectionId: string,
  page: number,
): Promise<PagedResults<SearchResultItem>> {
  const definition = getDiscoverSectionDefinition(sectionId);
  if (!definition) {
    throw new Error(`[ReadComicOnline] Unknown discover search section: ${sectionId}`);
  }

  if (definition.source === "desktop-tab") {
    const request: Request = {
      url: DOMAIN,
      method: "GET",
      headers: {
        cookie: "dsk_ui=1",
      },
    };
    const $ = await fetchCheerio(request);

    return {
      items: parseDesktopTabItems($, definition.tabId).map((item) => item as SearchResultItem),
      metadata: undefined,
    };
  }

  const request: Request = {
    url: buildDiscoverListUrl(definition.path, page),
    method: "GET",
  };
  const $ = await fetchCheerio(request);
  const items = parseSearchResults($);

  return {
    items,
    metadata: parseHasNextPage($) ? { page: page + 1 } : undefined,
  };
}

function readDiscoverSectionSearchId(filters: SearchFilterValue[]): string | undefined {
  const entry = filters.find((filter) => filter.id === DISCOVER_SECTION_SEARCH_METADATA_ID);
  return typeof entry?.value === "string" ? entry.value : undefined;
}

function formatGenreValues(values: string[]): string {
  return values.length > 0 ? `${values.join(",")},` : "";
}

type AdvancedSearchRequest = {
  searchTerm: string;
  includedGenres: string[];
  excludedGenres: string[];
  status: string;
  publicationYear: string;
  page: number;
};

async function fetchAdvancedSearchResults(
  searchRequest: AdvancedSearchRequest,
): Promise<SearchResultItem[]> {
  const terms = buildSearchTermVariants(searchRequest.searchTerm);

  for (const term of terms) {
    const request: Request = {
      url: buildAdvancedSearchUrl({ ...searchRequest, searchTerm: term }),
      method: "GET",
    };
    const $ = await fetchCheerio(request);
    const items = parseSearchResults($);

    if (items.length > 0 || term === terms[terms.length - 1]) {
      return items;
    }
  }

  return [];
}

function buildAdvancedSearchUrl(searchRequest: AdvancedSearchRequest): string {
  return new URL(DOMAIN)
    .addPathComponent("AdvanceSearch")
    .setQueryItem("comicName", searchRequest.searchTerm)
    .setQueryItem("ig", formatGenreValues(searchRequest.includedGenres))
    .setQueryItem("eg", formatGenreValues(searchRequest.excludedGenres))
    .setQueryItem("status", searchRequest.status)
    .setQueryItem("pubDate", searchRequest.publicationYear)
    .setQueryItem("page", String(searchRequest.page))
    .toString();
}

function buildSearchTermVariants(searchTerm: string): string[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedTerm) return [""];

  const variants = [normalizedTerm];
  const withoutBracketedText = normalizeSearchTerm(
    normalizedTerm.replace(/\([^)]*\)|\[[^\]]*]|\{[^}]*}/g, " "),
  );
  const punctuationNormalized = normalizeSearchTerm(
    normalizedTerm.replace(/[()[\]{}:;,.!?'"“”‘’#&/\\_-]+/g, " "),
  );

  variants.push(
    withoutBracketedText,
    removeTrailingYear(normalizedTerm),
    punctuationNormalized,
    removeTrailingYear(punctuationNormalized),
  );

  return variants.filter(
    (variant, index) =>
      variant.length > 0 &&
      variants.findIndex((candidate) => candidate.toLowerCase() === variant.toLowerCase()) ===
        index,
  );
}

function normalizeSearchTerm(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function removeTrailingYear(value: string): string {
  return normalizeSearchTerm(value.replace(/\s+(?:19|20)\d{2}$/, ""));
}

function getVisibleSearchGenreOptions(): SearchGenreOption[] {
  const hiddenGenres = getHiddenSearchGenres();

  return getSearchGenreOrder()
    .filter((genreId) => !hiddenGenres.includes(genreId))
    .map((genreId) => getSearchGenreOption(genreId))
    .filter((genre): genre is SearchGenreOption => genre !== undefined);
}

function buildDefaultSearchPageUrl(page: number): string {
  const path = new URL(DOMAIN).addPathComponent("ComicList");

  switch (getDefaultSearchPage()) {
    case "latest-update":
      path.addPathComponent("LatestUpdate");
      break;

    case "new-comic":
      path.addPathComponent("Newest");
      break;

    default:
      path.addPathComponent("MostPopular");
      break;
  }

  path.setQueryItem("page", String(page));
  return path.toString();
}

function buildDiscoverListUrl(path: string[], page: number): string {
  const url = new URL(DOMAIN);

  for (const segment of path) {
    url.addPathComponent(segment);
  }

  if (page > 1) {
    url.setQueryItem("page", String(page));
  }

  return url.toString();
}
