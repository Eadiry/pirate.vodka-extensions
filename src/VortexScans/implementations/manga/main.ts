import type { Request, SourceManga } from "@paperback/types";
import { URL } from "@paperback/types";
import { DOMAIN_API, PAGE_SIZE } from "../shared/models";
import type { VortexPost, VortexQueryResponse } from "../shared/models";
import { fetchJSON } from "../../services/network";
import { parseMangaDetails } from "./parsers";

function buildPostsUrl(page: number): string {
  return new URL(DOMAIN_API)
    .addPathComponent("posts")
    .setQueryItem("page", page.toString())
    .setQueryItem("perPage", PAGE_SIZE.toString())
    .setQueryItem("searchTerm", "")
    .setQueryItem("isNovel", "false")
    .setQueryItem("tag", "hot")
    .toString();
}

async function scanPostsForManga(mangaId: string): Promise<VortexPost | undefined> {
  for (let page = 1; page <= 10; page++) {
    const request: Request = { url: buildPostsUrl(page), method: "GET" };
    const data = await fetchJSON<VortexQueryResponse>(request);
    const posts = data.posts ?? [];

    const matched = posts.find((post) => post.id.toString() === mangaId);
    if (matched) {
      return matched;
    }

    if (posts.length < PAGE_SIZE) {
      break;
    }
  }

  return undefined;
}

export class MangaProvider {
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const scanned = await scanPostsForManga(mangaId);
    if (scanned) {
      return parseMangaDetails(scanned);
    }

    throw new Error(`Could not find manga with id: ${mangaId}`);
  }
}
