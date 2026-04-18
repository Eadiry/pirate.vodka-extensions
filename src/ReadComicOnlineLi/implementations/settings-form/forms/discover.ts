import {
  EditSection,
  Form,
  LabelRow,
  type FormItemElement,
  type FormSectionElement,
} from "@paperback/types";
import { getDiscoverSectionDefinition } from "../../shared/utils";
import {
  getDiscoverSectionOrder,
  getHiddenDiscoverSections,
  setDiscoverSectionOrder,
  setHiddenDiscoverSections,
} from "./main";

export class DiscoverSettingsForm extends Form {
  override getSections(): FormSectionElement<unknown>[] {
    const visibleSectionIds = this.getVisibleSectionIds();
    const hiddenSectionIds = this.getHiddenSectionIds();

    return [
      this.withEditSelectors(
        EditSection("visible-discover-sections", {
          id: "visible-discover-sections",
          header: visibleSectionIds.length > 0 ? "Visible" : "",
          footer: visibleSectionIds.length > 0 ? "Drag to reorder. Delete a row to hide it." : "",
          items: visibleSectionIds.map((sectionId) => this.sectionRow(sectionId)),
        }),
        Application.Selector(this as DiscoverSettingsForm, "handleVisibleSectionDelete"),
        Application.Selector(this as DiscoverSettingsForm, "handleVisibleSectionReorder"),
      ),
      this.withEditSelectors(
        EditSection("hidden-discover-sections", {
          id: "hidden-discover-sections",
          header: hiddenSectionIds.length > 0 ? "Hidden" : "",
          footer: hiddenSectionIds.length > 0 ? "Delete a row to restore it." : "",
          items: hiddenSectionIds.map((sectionId) => this.sectionRow(sectionId)),
        }),
        Application.Selector(this as DiscoverSettingsForm, "handleHiddenSectionDelete"),
        Application.Selector(this as DiscoverSettingsForm, "handleHiddenSectionReorder"),
      ),
    ];
  }

  private withEditSelectors(
    section: FormSectionElement<unknown>,
    onDeletionSelectorId: unknown,
    onReorderSelectorId: unknown,
  ): FormSectionElement<unknown> {
    return {
      ...section,
      allowDeletion: true,
      allowReorder: true,
      onDeletionSelectorId,
      onReorderSelectorId,
    } as unknown as FormSectionElement<unknown>;
  }

  private getVisibleSectionIds(): string[] {
    const hiddenSections = getHiddenDiscoverSections();

    return getDiscoverSectionOrder().filter((sectionId) => !hiddenSections.includes(sectionId));
  }

  private getHiddenSectionIds(): string[] {
    const hiddenSections = getHiddenDiscoverSections();

    return getDiscoverSectionOrder().filter((sectionId) => hiddenSections.includes(sectionId));
  }

  private sectionRow(sectionId: string): FormItemElement<unknown> {
    const section = getDiscoverSectionDefinition(sectionId);

    return LabelRow(`discover-section-${sectionId}`, {
      title: section?.title ?? sectionId,
    });
  }

  private saveSectionLists(visibleSections: string[], hiddenSections: string[]): void {
    setHiddenDiscoverSections(hiddenSections);
    setDiscoverSectionOrder([...visibleSections, ...hiddenSections]);
    Application.invalidateDiscoverSections();
    this.reloadForm();
  }

  private moveSection(
    sectionIds: string[],
    sourceIndex: number,
    destinationIndex: number,
    fallbackSectionId?: string,
  ): string[] {
    const sectionId = sectionIds[sourceIndex] ?? fallbackSectionId;
    if (!sectionId) {
      return sectionIds;
    }

    const nextSectionIds = [...sectionIds];
    this.removeSection(nextSectionIds, sourceIndex, sectionId);
    nextSectionIds.splice(destinationIndex, 0, sectionId);

    return nextSectionIds;
  }

  private removeSection(sectionIds: string[], index: number, sectionId: string): void {
    const existingIndex = sectionIds[index] === sectionId ? index : sectionIds.indexOf(sectionId);
    if (existingIndex >= 0) {
      sectionIds.splice(existingIndex, 1);
    }
  }

  private getSectionIdFromCallbackArgs(args: unknown[]): string | undefined {
    for (const arg of args) {
      if (typeof arg === "string") {
        return this.normalizeCallbackSectionId(arg);
      }

      if (typeof arg === "object" && arg !== null && "id" in arg) {
        const rowId = (arg as { id?: unknown }).id;
        if (typeof rowId === "string") {
          return this.normalizeCallbackSectionId(rowId);
        }
      }
    }

    return undefined;
  }

  private getCallbackIndexes(args: unknown[]): number[] {
    return args.filter((arg): arg is number => typeof arg === "number");
  }

  private normalizeCallbackSectionId(value: string): string | undefined {
    const sectionId = value.startsWith("discover-section-")
      ? value.slice("discover-section-".length)
      : value;

    return getDiscoverSectionDefinition(sectionId) ? sectionId : undefined;
  }

  async handleVisibleSectionReorder(...args: unknown[]): Promise<void> {
    const [sourceIndex, destinationIndex] = this.getCallbackIndexes(args);
    if (sourceIndex === undefined || destinationIndex === undefined) {
      return;
    }

    const sectionId = this.getSectionIdFromCallbackArgs(args);

    this.saveSectionLists(
      this.moveSection(this.getVisibleSectionIds(), sourceIndex, destinationIndex, sectionId),
      this.getHiddenSectionIds(),
    );
  }

  async handleVisibleSectionDelete(...args: unknown[]): Promise<void> {
    const visibleSections = this.getVisibleSectionIds();
    const [index = -1] = this.getCallbackIndexes(args);
    const sectionId = this.getSectionIdFromCallbackArgs(args);
    const deletedSectionId = sectionId ?? visibleSections[index];
    if (!deletedSectionId) {
      return;
    }

    this.removeSection(visibleSections, index, deletedSectionId);
    this.saveSectionLists(visibleSections, [...this.getHiddenSectionIds(), deletedSectionId]);
  }

  async handleHiddenSectionReorder(...args: unknown[]): Promise<void> {
    const [sourceIndex, destinationIndex] = this.getCallbackIndexes(args);
    if (sourceIndex === undefined || destinationIndex === undefined) {
      return;
    }

    const sectionId = this.getSectionIdFromCallbackArgs(args);

    this.saveSectionLists(
      this.getVisibleSectionIds(),
      this.moveSection(this.getHiddenSectionIds(), sourceIndex, destinationIndex, sectionId),
    );
  }

  async handleHiddenSectionDelete(...args: unknown[]): Promise<void> {
    const hiddenSections = this.getHiddenSectionIds();
    const [index = -1] = this.getCallbackIndexes(args);
    const sectionId = this.getSectionIdFromCallbackArgs(args);
    const restoredSectionId = sectionId ?? hiddenSections[index];
    if (!restoredSectionId) {
      return;
    }

    this.removeSection(hiddenSections, index, restoredSectionId);
    this.saveSectionLists([...this.getVisibleSectionIds(), restoredSectionId], hiddenSections);
  }
}
