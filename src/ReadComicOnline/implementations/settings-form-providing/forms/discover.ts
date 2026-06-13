import {
  EditSection,
  Form,
  LabelRow,
  Section,
  ToggleRow,
  type FormItemElement,
  type FormSectionElement,
  type SelectorID,
  type ToggleRowProps,
} from "@paperback/types";
import {
  CONSOLIDATED_DISCOVER_GROUPS,
  type ConsolidatedDiscoverGroupDefinition,
} from "../../shared/models";
import { getDiscoverSectionDefinition } from "../../shared/utils";
import {
  getConsolidateDiscoverSections,
  getConsolidatedDiscoverGroupOrder,
  getDiscoverSectionOrder,
  getHiddenDiscoverSections,
  setConsolidateDiscoverSections,
  setConsolidatedDiscoverGroupOrder,
  setDiscoverSectionOrder,
  setHiddenDiscoverSections,
} from "./main";
import {
  getCallbackIndexes,
  getCallbackRowId,
  moveSettingId,
  normalizePrefixedSettingId,
  removeSettingId,
} from "../utils";

export class DiscoverSettingsForm extends Form {
  private hiddenSectionRowSelectHandlers: Record<string, { handleSelect: () => Promise<void> }> =
    {};

  override getSections(): FormSectionElement<unknown>[] {
    const visibleSectionIds = this.getVisibleSectionIds();
    const hiddenSectionIds = this.getHiddenSectionIds();
    const sections: FormSectionElement<unknown>[] = [
      Section(
        {
          id: "discover-consolidation",
          footer: "Group related discover sections into selectable chips.\n\n",
        },
        [this.consolidateDiscoverSectionsRow()],
      ),
    ];
    this.hiddenSectionRowSelectHandlers = {};

    if (getConsolidateDiscoverSections()) {
      const visibleGroupIds = this.getVisibleConsolidatedGroupIds();

      if (visibleGroupIds.length > 0) {
        sections.push(
          EditSection("visible-consolidated-discover-groups", {
            id: "visible-consolidated-discover-groups",
            header: "Consolidated Section Order",
            footer: "Long press to reorder. Hide all child sections below to hide a group.\n\n",
            items: visibleGroupIds.map((groupId) => this.consolidatedGroupRow(groupId)),
            allowReorder: true,
            onReorder: Application.Selector(
              this as DiscoverSettingsForm,
              "handleConsolidatedGroupReorder",
            ),
          }),
        );
      }
    }

    if (visibleSectionIds.length > 0) {
      sections.push(
        EditSection("visible-discover-sections", {
          id: "visible-discover-sections",
          header: "Prioritized Sections",
          footer: "Long press to reorder. Swipe to remove\n\n",
          items: visibleSectionIds.map((sectionId) => this.sectionRow(sectionId)),
          allowDeletion: true,
          allowReorder: true,
          onDeletion: Application.Selector(
            this as DiscoverSettingsForm,
            "handleVisibleSectionDelete",
          ),
          onReorder: Application.Selector(
            this as DiscoverSettingsForm,
            "handleVisibleSectionReorder",
          ),
        }),
      );
    }

    if (hiddenSectionIds.length > 0) {
      sections.push(
        Section(
          {
            id: "hidden-discover-sections",
            header: "Available Sections",
            footer: "Tap to restore\n\n",
          },
          hiddenSectionIds.map((sectionId) => this.hiddenSectionRow(sectionId)),
        ),
      );
    }

    return sections;
  }

  private consolidateDiscoverSectionsRow(): FormItemElement<unknown> {
    const props: ToggleRowProps = {
      title: "Consolidate Discover Sections",
      value: getConsolidateDiscoverSections(),
      onValueChange: Application.Selector(
        this as DiscoverSettingsForm,
        "handleConsolidateDiscoverSectionsChange",
      ),
    };

    return ToggleRow("consolidate-discover-sections", props);
  }

  private getVisibleSectionIds(): string[] {
    const hiddenSections = getHiddenDiscoverSections();

    return getDiscoverSectionOrder().filter((sectionId) => !hiddenSections.includes(sectionId));
  }

  private getHiddenSectionIds(): string[] {
    const hiddenSections = getHiddenDiscoverSections();

    return getDiscoverSectionOrder().filter((sectionId) => hiddenSections.includes(sectionId));
  }

  private sectionRow(
    sectionId: string,
    onSelect?: SelectorID<() => Promise<void>>,
  ): FormItemElement<unknown> {
    const section = getDiscoverSectionDefinition(sectionId);

    return LabelRow(`discover-section-${sectionId}`, {
      title: section?.title ?? sectionId,
      onSelect,
    });
  }

  private hiddenSectionRow(sectionId: string): FormItemElement<unknown> {
    const handler = {
      handleSelect: async (): Promise<void> => {
        this.restoreHiddenSection(sectionId);
      },
    };

    this.hiddenSectionRowSelectHandlers[sectionId] = handler;

    return this.sectionRow(sectionId, Application.Selector(handler, "handleSelect"));
  }

  private getVisibleConsolidatedGroupIds(): string[] {
    const hiddenSections = getHiddenDiscoverSections();

    return getConsolidatedDiscoverGroupOrder().filter((groupId) => {
      const group = this.getConsolidatedGroup(groupId);

      return group?.sections.some((tag) => !hiddenSections.includes(tag.sectionId)) ?? false;
    });
  }

  private getConsolidatedGroup(groupId: string): ConsolidatedDiscoverGroupDefinition | undefined {
    return CONSOLIDATED_DISCOVER_GROUPS.find((group) => group.id === groupId);
  }

  private consolidatedGroupRow(groupId: string): FormItemElement<unknown> {
    const group = this.getConsolidatedGroup(groupId);

    return LabelRow(`consolidated-discover-group-${groupId}`, {
      title: group?.title ?? groupId,
    });
  }

  private saveSectionLists(visibleSections: string[], hiddenSections: string[]): void {
    setHiddenDiscoverSections(hiddenSections);
    setDiscoverSectionOrder([...visibleSections, ...hiddenSections]);
    Application.invalidateDiscoverSections();
    this.reloadForm();
  }

  private saveConsolidatedSettings(): void {
    Application.invalidateDiscoverSections();
    this.reloadForm();
  }

  private getSectionIdFromCallbackArgs(args: unknown[]): string | undefined {
    const rowId = getCallbackRowId(args);
    return rowId ? this.normalizeCallbackSectionId(rowId) : undefined;
  }

  private normalizeCallbackSectionId(value: string): string | undefined {
    return normalizePrefixedSettingId(
      value,
      "discover-section-",
      (sectionId) => getDiscoverSectionDefinition(sectionId) !== undefined,
    );
  }

  private getConsolidatedGroupIdFromCallbackArgs(args: unknown[]): string | undefined {
    const rowId = getCallbackRowId(args);

    return rowId
      ? normalizePrefixedSettingId(
          rowId,
          "consolidated-discover-group-",
          (groupId) => this.getConsolidatedGroup(groupId) !== undefined,
        )
      : undefined;
  }

  async handleVisibleSectionReorder(...args: unknown[]): Promise<void> {
    const [sourceIndex, destinationIndex] = getCallbackIndexes(args);
    if (sourceIndex === undefined || destinationIndex === undefined) {
      return;
    }

    const sectionId = this.getSectionIdFromCallbackArgs(args);

    this.saveSectionLists(
      moveSettingId(this.getVisibleSectionIds(), sourceIndex, destinationIndex, sectionId),
      this.getHiddenSectionIds(),
    );
  }

  async handleVisibleSectionDelete(...args: unknown[]): Promise<void> {
    const visibleSections = this.getVisibleSectionIds();
    const [index = -1] = getCallbackIndexes(args);
    const sectionId = this.getSectionIdFromCallbackArgs(args);
    const deletedSectionId = sectionId ?? visibleSections[index];
    if (!deletedSectionId) {
      return;
    }

    removeSettingId(visibleSections, index, deletedSectionId);
    this.saveSectionLists(visibleSections, [...this.getHiddenSectionIds(), deletedSectionId]);
  }

  async handleConsolidateDiscoverSectionsChange(value: boolean): Promise<void> {
    setConsolidateDiscoverSections(value);
    this.saveConsolidatedSettings();
  }

  async handleConsolidatedGroupReorder(...args: unknown[]): Promise<void> {
    const [sourceIndex, destinationIndex] = getCallbackIndexes(args);
    if (sourceIndex === undefined || destinationIndex === undefined) {
      return;
    }

    const groupId = this.getConsolidatedGroupIdFromCallbackArgs(args);
    const visibleGroupIds = this.getVisibleConsolidatedGroupIds();
    const nextVisibleGroupIds = moveSettingId(
      visibleGroupIds,
      sourceIndex,
      destinationIndex,
      groupId,
    );
    const visibleGroupIdSet = new Set(visibleGroupIds);
    const visibleGroupQueue = [...nextVisibleGroupIds];
    const nextGroupOrder = getConsolidatedDiscoverGroupOrder().map((currentGroupId) =>
      visibleGroupIdSet.has(currentGroupId)
        ? (visibleGroupQueue.shift() ?? currentGroupId)
        : currentGroupId,
    );

    for (const remainingGroupId of visibleGroupQueue) {
      if (!nextGroupOrder.includes(remainingGroupId)) {
        nextGroupOrder.push(remainingGroupId);
      }
    }

    setConsolidatedDiscoverGroupOrder(nextGroupOrder);
    this.saveConsolidatedSettings();
  }

  private restoreHiddenSection(sectionId: string): void {
    const hiddenSections = this.getHiddenSectionIds();
    if (!hiddenSections.includes(sectionId)) {
      return;
    }

    removeSettingId(hiddenSections, hiddenSections.indexOf(sectionId), sectionId);
    this.saveSectionLists([...this.getVisibleSectionIds(), sectionId], hiddenSections);
  }
}
