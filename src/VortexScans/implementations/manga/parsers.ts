import type { SourceManga } from "@paperback/types";
import { ContentRating } from "@paperback/types";
import * as cheerio from "cheerio";
import { DOMAIN } from "../shared/models";
import type { VortexPost } from "../shared/models";
import { buildMangaId } from "../shared/utils";

type SerializedValue<T> = [number, T];

interface VortexSeriesPageProps {
  post?: SerializedValue<{
    postContent?: SerializedValue<string>;
  }>;
}

export function parseMangaPostContent(html: string): string | undefined {
  const $ = cheerio.load(html);
  const propsValue = $("astro-island")
    .filter((_, element) => {
      return ($(element).attr("opts") ?? "").includes("SeriesChaptersPanelIsland");
    })
    .first()
    .attr("props");

  if (propsValue) {
    try {
      const props = JSON.parse(propsValue) as VortexSeriesPageProps;
      const postContent = props.post?.[1].postContent?.[1]?.trim();
      if (postContent) return postContent;
    } catch {
      // Fall back to page metadata when the serialized island shape changes.
    }
  }

  return $("meta[name='description']").attr("content")?.trim() || undefined;
}

export function parseMangaDetails(post: VortexPost): SourceManga {
  const mangaId = buildMangaId(post.id, post.slug);

  const synopsis = Application.decodeHTMLEntities((post.postContent ?? "").replace(/<[^>]+>/g, ""));
  const secondaryTitles = post.alternativeTitles
    ? post.alternativeTitles
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];

  return {
    mangaId,
    mangaInfo: {
      primaryTitle: Application.decodeHTMLEntities(post.postTitle),
      secondaryTitles,
      thumbnailUrl: post.featuredImage || "",
      synopsis,
      status: post.seriesStatus ?? "UNKNOWN",
      contentRating: ContentRating.EVERYONE,

      tagGroups:
        post.genres && post.genres.length > 0
          ? [
              {
                id: "genres",
                title: "Genres",
                tags: post.genres.map((g) => ({
                  id: g.id.toString(),
                  title: g.name,
                })),
              },
            ]
          : [],

      additionalInfo: {
        slug: post.slug,
      },

      shareUrl: `${DOMAIN}/series/${post.slug}`,
    },
  };
}
