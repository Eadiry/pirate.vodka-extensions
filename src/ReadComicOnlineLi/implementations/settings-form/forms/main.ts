import { Form, type SettingsFormProviding } from "@paperback/types";
import { normalizeDiscoverSectionIds, normalizeSearchGenreIds } from "../utils";
import { ReadComicOnlineLiSettingsForm } from "./landing";

export function getHiddenDiscoverSections(): string[] {
  return normalizeDiscoverSectionIds(
    Application.getState("readcomiconlineli-hidden-discover-sections"),
    false,
  );
}

export function setHiddenDiscoverSections(value: string[]): void {
  Application.setState(
    normalizeDiscoverSectionIds(value, false),
    "readcomiconlineli-hidden-discover-sections",
  );
}

export function getDiscoverSectionOrder(): string[] {
  return normalizeDiscoverSectionIds(
    Application.getState("readcomiconlineli-discover-section-order"),
    true,
  );
}

export function setDiscoverSectionOrder(value: string[]): void {
  Application.setState(
    normalizeDiscoverSectionIds(value, true),
    "readcomiconlineli-discover-section-order",
  );
}

export function getHiddenSearchGenres(): string[] {
  return normalizeSearchGenreIds(
    Application.getState("readcomiconlineli-hidden-search-genres"),
    false,
  );
}

export function setHiddenSearchGenres(value: string[]): void {
  Application.setState(
    normalizeSearchGenreIds(value, false),
    "readcomiconlineli-hidden-search-genres",
  );
}

export function getSearchGenreOrder(): string[] {
  return normalizeSearchGenreIds(
    Application.getState("readcomiconlineli-search-genre-order"),
    true,
  );
}

export function setSearchGenreOrder(value: string[]): void {
  Application.setState(
    normalizeSearchGenreIds(value, true),
    "readcomiconlineli-search-genre-order",
  );
}

export function getDefaultSearchSort(): string {
  return (
    (Application.getState("readcomiconlineli-default-search-sort") as string | undefined) ?? ""
  );
}

export function setDefaultSearchSort(value: string): void {
  Application.setState(value, "readcomiconlineli-default-search-sort");
}

export function getDefaultSearchPage(): string {
  return (
    (Application.getState("readcomiconlineli-default-search-page") as string | undefined) ??
    "most-popular"
  );
}

export function setDefaultSearchPage(value: string): void {
  Application.setState(value, "readcomiconlineli-default-search-page");
}

export class SettingsFormProvider implements SettingsFormProviding {
  async getSettingsForm(): Promise<Form> {
    return new ReadComicOnlineLiSettingsForm();
  }
}
