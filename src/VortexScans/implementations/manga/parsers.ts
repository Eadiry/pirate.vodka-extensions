import type { SourceManga } from "@paperback/types";
import { ContentRating } from "@paperback/types";
import * as cheerio from "cheerio";
import { DOMAIN } from "../shared/models";
import type { VortexPost } from "../shared/models";
import { buildMangaId } from "../shared/utils";

interface VortexSeriesPageProps {
  post?: VortexPost;
}

export function parseMangaPage(html: string): VortexPost | undefined {
  const $ = cheerio.load(html);
  const propsValue = $("astro-island")
    .filter((_, element) => {
      return ($(element).attr("opts") ?? "").includes("SeriesChaptersPanelIsland");
    })
    .first()
    .attr("props");

  if (!propsValue) return undefined;

  try {
    const props = deserializeAstroValue(JSON.parse(propsValue)) as VortexSeriesPageProps;
    const post = props.post;

    return post && typeof post.id === "number" && post.slug && post.postTitle ? post : undefined;
  } catch {
    return undefined;
  }
}

export function parseMangaDetails(
  post: VortexPost,
  mangaId = buildMangaId(post.id, post.slug),
): SourceManga {
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

function deserializeAstroValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "number") {
      return deserializeAstroValue(value[1]);
    }
    return value.map(deserializeAstroValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deserializeAstroValue(entry)]),
    );
  }

  return value;
}
