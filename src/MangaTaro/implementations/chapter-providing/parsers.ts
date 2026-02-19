import type { Chapter, SourceManga } from "@paperback/types";
import type { MangaTaroChaptersResponse } from "../shared/models";
import { parseRelativeDate } from "../shared/utils";

export function parseChapterList(
  json: MangaTaroChaptersResponse,
  sourceManga: SourceManga,
): Chapter[] {
  return json.chapters.map((ch) => {
    const groupName = ch.group_name?.trim() || "No Group";

    // use empty string when title is N/A
    const rawTitle = ch.title?.trim();
    const title = !rawTitle || rawTitle === "N/A" ? "" : rawTitle;

    const chapNum = parseFloat(ch.chapter) || 0;

    return {
      chapterId: ch.id,
      sourceManga,
      title,
      chapNum,
      volume: 0,
      langCode: ch.language ?? "en",
      version: groupName,
      sortingIndex: chapNum,
      publishDate: parseRelativeDate(ch.date),
    };
  });
}
