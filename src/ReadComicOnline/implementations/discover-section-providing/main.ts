import {
  DiscoverSectionType,
  URL,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  type Request,
} from "@paperback/types";
import { fetchCheerio } from "../../services/network";
import {
  getConsolidateDiscoverSections,
  getConsolidatedDiscoverGroupOrder,
  getDiscoverSectionOrder,
  getHiddenDiscoverSections,
} from "../settings-form-providing/forms/main";
import {
  CONSOLIDATED_DISCOVER_GROUPS,
  DISCOVER_SECTION_SEARCH_METADATA_ID,
  DOMAIN,
  type ConsolidatedDiscoverGroupDefinition,
  type ConsolidatedDiscoverTagDefinition,
  type DiscoverSectionDefinition,
  type Metadata,
} from "../shared/models";
import { getDiscoverSectionDefinition } from "../shared/utils";
import { parseDesktopTabItems, parseDiscoverItems } from "./parsers";

export class DiscoverProvider {
  async getDiscoverSections(): Promise<DiscoverSection[]> {
    if (getConsolidateDiscoverSections()) {
      return getConsolidatedDiscoverSections();
    }

    const hiddenSections = getHiddenDiscoverSections();

    return getDiscoverSectionOrder()
      .map((sectionId) => getDiscoverSectionDefinition(sectionId))
      .filter(
        (section): section is DiscoverSectionDefinition =>
          section !== undefined && !hiddenSections.includes(section.id),
      )
      .map((section) => ({
        id: section.id,
        title: section.title,
        type: DiscoverSectionType.simpleCarousel,
      }));
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: Metadata,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const consolidatedGroup = getConsolidatedDiscoverGroup(section.id);
    if (consolidatedGroup) {
      return {
        items: getVisibleConsolidatedTags(consolidatedGroup).map((tag) =>
          createConsolidatedDiscoverItem(consolidatedGroup, tag),
        ),
        metadata: undefined,
      };
    }

    const definition = getDiscoverSectionDefinition(section.id);
    if (!definition) {
      throw new Error(`[ReadComicOnline] Unknown discover section: ${section.id}`);
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
        items: parseDesktopTabItems($, definition.tabId),
        metadata: undefined,
      };
    }

    const page = metadata?.page ?? 1;
    const request: Request = {
      url: buildSectionUrl(definition.path, page),
      method: "GET",
    };
    const $ = await fetchCheerio(request);
    const items = parseDiscoverItems($);
    const hasMore = $("a.next_bt").length > 0;

    return {
      items,
      metadata: hasMore ? { page: page + 1 } : undefined,
    };
  }
}

function getConsolidatedDiscoverSections(): DiscoverSection[] {
  return getOrderedConsolidatedGroups()
    .map((group) => ({
      group,
      visibleTags: getVisibleConsolidatedTags(group),
    }))
    .filter(({ visibleTags }) => visibleTags.length > 0)
    .map(({ group, visibleTags }) => ({
      id: createConsolidatedDiscoverSectionId(group, visibleTags),
      title: group.title,
      type: DiscoverSectionType.genres,
    }));
}

function getOrderedConsolidatedGroups(): ConsolidatedDiscoverGroupDefinition[] {
  const groupById = new Map(CONSOLIDATED_DISCOVER_GROUPS.map((group) => [group.id, group]));

  return getConsolidatedDiscoverGroupOrder()
    .map((groupId) => groupById.get(groupId))
    .filter((group): group is ConsolidatedDiscoverGroupDefinition => group !== undefined);
}

function getConsolidatedDiscoverGroup(
  sectionId: string,
): ConsolidatedDiscoverGroupDefinition | undefined {
  const groupId = readConsolidatedDiscoverGroupId(sectionId);

  return CONSOLIDATED_DISCOVER_GROUPS.find((group) => group.id === groupId);
}

const CONSOLIDATED_SECTION_ID_SEPARATOR = "__";

function createConsolidatedDiscoverSectionId(
  group: ConsolidatedDiscoverGroupDefinition,
  visibleTags: ConsolidatedDiscoverTagDefinition[],
): string {
  return `${group.id}${CONSOLIDATED_SECTION_ID_SEPARATOR}${visibleTags
    .map((tag) => tag.sectionId)
    .join("_")}`;
}

function readConsolidatedDiscoverGroupId(sectionId: string): string {
  return sectionId.split(CONSOLIDATED_SECTION_ID_SEPARATOR)[0] ?? sectionId;
}

function getVisibleConsolidatedTags(
  group: ConsolidatedDiscoverGroupDefinition,
): ConsolidatedDiscoverTagDefinition[] {
  const hiddenSections = getHiddenDiscoverSections();

  return getOrderedConsolidatedTags(group).filter((tag) => !hiddenSections.includes(tag.sectionId));
}

function getOrderedConsolidatedTags(
  group: ConsolidatedDiscoverGroupDefinition,
): ConsolidatedDiscoverTagDefinition[] {
  const tagBySectionId = new Map(group.sections.map((tag) => [tag.sectionId, tag]));
  const orderedTags = getDiscoverSectionOrder()
    .map((sectionId) => tagBySectionId.get(sectionId))
    .filter((tag): tag is ConsolidatedDiscoverTagDefinition => tag !== undefined);

  for (const tag of group.sections) {
    if (!orderedTags.some((orderedTag) => orderedTag.sectionId === tag.sectionId)) {
      orderedTags.push(tag);
    }
  }

  return orderedTags;
}

function createConsolidatedDiscoverItem(
  group: ConsolidatedDiscoverGroupDefinition,
  tag: ConsolidatedDiscoverTagDefinition,
): DiscoverSectionItem {
  return {
    type: "genresCarouselItem" as const,
    name: tag.title,
    searchQuery: {
      title: `${group.title}: ${tag.title}`,
      metadata: [{ id: DISCOVER_SECTION_SEARCH_METADATA_ID, value: tag.sectionId }],
    },
    metadata: {
      groupId: group.id,
      sectionId: tag.sectionId,
    },
  };
}

function buildSectionUrl(path: string[], page: number): string {
  const url = new URL(DOMAIN);

  for (const segment of path) {
    url.addPathComponent(segment);
  }

  if (page > 1) {
    url.setQueryItem("page", String(page));
  }

  return url.toString();
}
