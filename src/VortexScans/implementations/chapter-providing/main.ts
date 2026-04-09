import type { Chapter, ChapterDetails, Request, SourceManga } from "@paperback/types";
import { URL } from "@paperback/types";
import { DOMAIN, DOMAIN_API } from "../shared/models";
import type { VortexChaptersResponse } from "../shared/models";
import { parseMangaId } from "../shared/utils";
import { fetchJSON, fetchText } from "../../services/network";
import { parseChapterDetails, parseChapterList } from "./parsers";

export class ChapterProvider {
  async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
    const { id: postId } = parseMangaId(sourceManga.mangaId);

    const url = new URL(DOMAIN_API)
      .addPathComponent("chapters")
      .setQueryItem("postId", postId)
      .setQueryItem("skip", "0")
      .setQueryItem("take", "500")
      .setQueryItem("order", "desc")
      .setQueryItem("search", "")
      .toString();

    const request: Request = { url, method: "GET" };
    const data = await fetchJSON<VortexChaptersResponse>(request);

    return parseChapterList(data, sourceManga);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const sourceManga = chapter.sourceManga;

    if (chapter.title?.toLowerCase().includes("(locked)")) {
      throw new Error("This chapter is locked (premium/coins required).");
    }

    const slug =
      sourceManga.mangaInfo?.additionalInfo?.slug ?? parseMangaId(sourceManga.mangaId).slug;

    if (!slug) {
      throw new Error(`Missing slug for manga ${sourceManga.mangaId}`);
    }

    const url = new URL(DOMAIN)
      .addPathComponent("series")
      .addPathComponent(slug)
      .addPathComponent(chapter.chapterId)
      .toString();

    const html = await fetchText({ url, method: "GET" });

    return parseChapterDetails(html, chapter);
  }
}
