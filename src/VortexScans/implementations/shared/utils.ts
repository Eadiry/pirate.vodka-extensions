function encodeMangaSlug(slug: string): string {
  return slug.replace(
    /[^A-Za-z0-9_-]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildMangaId(id: number | string, slug: string): string {
  return `${id}:${encodeMangaSlug(slug)}`;
}

export function parseMangaId(mangaId: string): { id: string; slug?: string } {
  const delimiter = mangaId.includes(":")
    ? ":"
    : mangaId.includes("/")
      ? "/"
      : mangaId.includes("|")
        ? "|"
        : undefined;
  const [id, rawSlug] = delimiter ? mangaId.split(delimiter) : [mangaId, undefined];

  return {
    id,
    slug: rawSlug?.trim() ? decodeURIComponent(rawSlug) : undefined,
  };
}

export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null),
      );
    });
  });
}
