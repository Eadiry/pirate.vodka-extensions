import {
  EditSection,
  Form,
  LabelRow,
  Section,
  SelectRow,
  type FormItemElement,
  type FormSectionElement,
  type SelectRowProps,
  type SelectorID,
} from "@paperback/types";
import {
  getDefaultSearchPage,
  getDefaultSearchSort,
  getHiddenSearchGenres,
  getSearchGenreOrder,
  setDefaultSearchPage,
  setDefaultSearchSort,
  setHiddenSearchGenres,
  setSearchGenreOrder,
} from "./main";
import { getSearchGenreOption } from "../../shared/utils";
import { DEFAULT_PAGE_OPTIONS, SEARCH_STATUS_OPTIONS } from "../models";

export class SearchSettingsForm extends Form {
  private hiddenGenreRowSelectHandlers: Record<string, { handleSelect: () => Promise<void> }> = {};

  override getSections(): FormSectionElement<unknown>[] {
    const visibleGenreIds = this.getVisibleGenreIds();
    const hiddenGenreIds = this.getHiddenGenreIds();
    const sections: FormSectionElement<unknown>[] = [
      Section(
        {
          id: "default-sort",
          footer: "Status option applied by default in search.",
        },
        [this.defaultSortRow()],
      ),
    ];

    if (getDefaultSearchSort() === "") {
      sections.push(
        Section(
          {
            id: "default-search-page",
            footer: "Page used when search is opened without a query or filters.",
          },
          [this.defaultSearchPageRow()],
        ),
      );
    }

    this.hiddenGenreRowSelectHandlers = {};

    if (visibleGenreIds.length > 0) {
      sections.push(
        EditSection("visible-search-genres", {
          id: "visible-search-genres",
          header: "Prioritized Genres",
          footer: "Long press to reorder. Swipe to remove",
          items: visibleGenreIds.map((genreId) => this.genreRow(genreId)),
          onDeletion: Application.Selector(this as SearchSettingsForm, "handleVisibleGenreDelete"),
          onReorder: Application.Selector(this as SearchSettingsForm, "handleVisibleGenreReorder"),
        }),
      );
    }

    if (hiddenGenreIds.length > 0) {
      sections.push(
        Section(
          {
            id: "hidden-search-genres",
            header: "Available Genres",
            footer: "Tap to restore",
          },
          hiddenGenreIds.map((genreId) => this.hiddenGenreRow(genreId)),
        ),
      );
    }

    return sections;
  }

  defaultSortRow(): FormItemElement<unknown> {
    const props: SelectRowProps = {
      title: "Default Sort",
      options: SEARCH_STATUS_OPTIONS,
      value: [getDefaultSearchSort()],
      minItemCount: 1,
      maxItemCount: 1,
      onValueChange: Application.Selector(this as SearchSettingsForm, "handleDefaultSortChange"),
    };

    return SelectRow("default-search-sort", props);
  }

  defaultSearchPageRow(): FormItemElement<unknown> {
    const props: SelectRowProps = {
      title: "Default Page",
      options: DEFAULT_PAGE_OPTIONS,
      value: [getDefaultSearchPage()],
      minItemCount: 1,
      maxItemCount: 1,
      onValueChange: Application.Selector(
        this as SearchSettingsForm,
        "handleDefaultSearchPageChange",
      ),
    };

    return SelectRow("default-search-page", props);
  }

  async handleDefaultSortChange(value: string[]): Promise<void> {
    setDefaultSearchSort(value[0] ?? "");
    this.reloadForm();
  }

  async handleDefaultSearchPageChange(value: string[]): Promise<void> {
    setDefaultSearchPage(value[0] ?? "most-popular");
    this.reloadForm();
  }

  private getVisibleGenreIds(): string[] {
    const hiddenGenres = getHiddenSearchGenres();

    return getSearchGenreOrder().filter((genreId) => !hiddenGenres.includes(genreId));
  }

  private getHiddenGenreIds(): string[] {
    const hiddenGenres = getHiddenSearchGenres();

    return getSearchGenreOrder().filter((genreId) => hiddenGenres.includes(genreId));
  }

  private genreRow(
    genreId: string,
    onSelect?: SelectorID<() => Promise<void>>,
  ): FormItemElement<unknown> {
    const genre = getSearchGenreOption(genreId);

    return LabelRow(`search-genre-${genreId}`, {
      title: genre?.value ?? genreId,
      onSelect,
    });
  }

  private hiddenGenreRow(genreId: string): FormItemElement<unknown> {
    const handler = {
      handleSelect: async (): Promise<void> => {
        this.restoreHiddenGenre(genreId);
      },
    };

    this.hiddenGenreRowSelectHandlers[genreId] = handler;

    return this.genreRow(genreId, Application.Selector(handler, "handleSelect"));
  }

  private saveGenreLists(visibleGenres: string[], hiddenGenres: string[]): void {
    setHiddenSearchGenres(hiddenGenres);
    setSearchGenreOrder([...visibleGenres, ...hiddenGenres]);
    Application.invalidateSearchFilters();
    this.reloadForm();
  }

  private moveGenre(
    genreIds: string[],
    sourceIndex: number,
    destinationIndex: number,
    fallbackGenreId?: string,
  ): string[] {
    const genreId = genreIds[sourceIndex] ?? fallbackGenreId;
    if (!genreId) {
      return genreIds;
    }

    const nextGenreIds = [...genreIds];
    this.removeGenre(nextGenreIds, sourceIndex, genreId);
    const boundedDestinationIndex = Math.max(0, Math.min(destinationIndex, nextGenreIds.length));
    nextGenreIds.splice(boundedDestinationIndex, 0, genreId);

    return nextGenreIds;
  }

  private removeGenre(genreIds: string[], index: number, genreId: string): void {
    const existingIndex = genreIds[index] === genreId ? index : genreIds.indexOf(genreId);
    if (existingIndex >= 0) {
      genreIds.splice(existingIndex, 1);
    }
  }

  private getGenreIdFromCallbackArgs(args: unknown[]): string | undefined {
    for (const arg of args) {
      if (typeof arg === "string") {
        return this.normalizeCallbackGenreId(arg);
      }

      if (typeof arg === "object" && arg !== null && "id" in arg) {
        const rowId = (arg as { id?: unknown }).id;
        if (typeof rowId === "string") {
          return this.normalizeCallbackGenreId(rowId);
        }
      }
    }

    return undefined;
  }

  private getCallbackIndexes(args: unknown[]): number[] {
    return args.filter((arg): arg is number => typeof arg === "number");
  }

  private normalizeCallbackGenreId(value: string): string | undefined {
    const genreId = value.startsWith("search-genre-") ? value.slice("search-genre-".length) : value;

    return getSearchGenreOption(genreId) ? genreId : undefined;
  }

  async handleVisibleGenreReorder(...args: unknown[]): Promise<void> {
    const [sourceIndex, destinationIndex] = this.getCallbackIndexes(args);
    if (sourceIndex === undefined || destinationIndex === undefined) {
      return;
    }

    const genreId = this.getGenreIdFromCallbackArgs(args);

    this.saveGenreLists(
      this.moveGenre(this.getVisibleGenreIds(), sourceIndex, destinationIndex, genreId),
      this.getHiddenGenreIds(),
    );
  }

  async handleVisibleGenreDelete(...args: unknown[]): Promise<void> {
    const visibleGenres = this.getVisibleGenreIds();
    const [index = -1] = this.getCallbackIndexes(args);
    const genreId = this.getGenreIdFromCallbackArgs(args);
    const deletedGenreId = genreId ?? visibleGenres[index];
    if (!deletedGenreId) {
      return;
    }

    this.removeGenre(visibleGenres, index, deletedGenreId);
    this.saveGenreLists(visibleGenres, [...this.getHiddenGenreIds(), deletedGenreId]);
  }

  private restoreHiddenGenre(genreId: string): void {
    const hiddenGenres = this.getHiddenGenreIds();
    if (!hiddenGenres.includes(genreId)) {
      return;
    }

    this.removeGenre(hiddenGenres, hiddenGenres.indexOf(genreId), genreId);
    this.saveGenreLists([...this.getVisibleGenreIds(), genreId], hiddenGenres);
  }
}
