import type { Request, SourceManga } from "@paperback/types";
import { URL } from "@paperback/types";
import { DOMAIN, DOMAIN_API, PAGE_SIZE } from "../shared/models";
import type { VortexPost, VortexQueryResponse } from "../shared/models";
import { parseMangaId } from "../shared/utils";
import { fetchJSON, fetchText } from "../../services/network";
import { parseMangaDetails, parseMangaPostContent } from "./parsers";

function buildQueryUrl(searchTerm: string): string {
  return new URL(DOMAIN_API)
    .addPathComponent("query")
    .setQueryItem("perPage", PAGE_SIZE.toString())
    .setQueryItem("page", "1")
    .setQueryItem("orderBy", "lastChapterAddedAt")
    .setQueryItem("orderDirection", "desc")
    .setQueryItem("searchTerm", searchTerm)
    .toString();
}

function slugToSearchTerm(slug: string): string {
  return slug.trim().replace(/-/g, " ").replace(/\s+/g, " ");
}

async function queryMangaDetails(mangaId: string, slug: string): Promise<VortexPost | undefined> {
  const searchTerm = slugToSearchTerm(slug);
  const attempts = [searchTerm];

  if (searchTerm.includes("'")) {
    attempts.push(searchTerm.replace(/'/g, "\u2019"));
  }

  for (const term of attempts) {
    const request: Request = { url: buildQueryUrl(term), method: "GET" };
    const data = await fetchJSON<VortexQueryResponse>(request);
    const matched = data.posts?.find((post) => post.id.toString() === mangaId);

    if (matched) {
      return matched;
    }
  }

  return undefined;
}

async function getMangaPostContent(slug: string): Promise<string | undefined> {
  try {
    const url = new URL(DOMAIN).addPathComponent("series").addPathComponent(slug).toString();
    const html = await fetchText({ url, method: "GET" });
    return parseMangaPostContent(html);
  } catch {
    return undefined;
  }
}

export class MangaProvider {
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const parsed = parseMangaId(mangaId);
    const slug = parsed.slug;

    if (!slug) {
      throw new Error(`Missing slug in mangaId: ${mangaId}`);
    }

    try {
      const queried = await queryMangaDetails(parsed.id, slug);
      if (queried) {
        const postContent = await getMangaPostContent(slug);
        return parseMangaDetails(postContent ? { ...queried, postContent } : queried);
      }
    } catch {
      // fall through to the final not-found error
    }

    throw new Error(`Could not fetch manga details for id: ${parsed.id}`);
  }
}
