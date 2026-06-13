import {
  Form,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
  type FormItemElement,
  type FormSectionElement,
  type SelectRowProps,
  type ToggleRowProps,
} from "@paperback/types";
import { DiscoverSettingsForm } from "./discover";
import { SearchSettingsForm } from "./search";
import { ChapterSettingsForm } from "./chapter";
import { DOMAIN_MODE_OPTIONS } from "../models";
import {
  getDomainMode,
  getUseBackupDomainFallback,
  setDomainMode,
  setUseBackupDomainFallback,
} from "./main";

export class ReadComicOnlineSettingsForm extends Form {
  override getSections(): FormSectionElement<unknown>[] {
    const domainRows = [this.domainModeRow()];
    const showBackupDomainFallback = getDomainMode() === "main";
    if (showBackupDomainFallback) {
      domainRows.push(this.backupDomainFallbackRow());
    }

    return [
      Section("mainSettings", [
        NavigationRow("search_settings", {
          title: "Search Settings",
          form: new SearchSettingsForm(),
        }),
        NavigationRow("discover_settings", {
          title: "Discover Settings",
          form: new DiscoverSettingsForm(),
        }),
        NavigationRow("chapter_settings", {
          title: "Chapter Settings",
          form: new ChapterSettingsForm(),
        }),
      ]),
      Section(
        {
          id: showBackupDomainFallback ? "domainSettings-main" : "domainSettings-backup",
          header: "",
          footer: showBackupDomainFallback
            ? "Retry the backup domain when the main domain request fails\n\n"
            : undefined,
        },
        domainRows,
      ),
    ];
  }

  domainModeRow(): FormItemElement<unknown> {
    const props: SelectRowProps = {
      title: "Domain",
      options: DOMAIN_MODE_OPTIONS,
      value: [getDomainMode()],
      minItemCount: 1,
      maxItemCount: 1,
      onValueChange: Application.Selector(
        this as ReadComicOnlineSettingsForm,
        "handleDomainModeChange",
      ),
    };

    return SelectRow("domain-mode", props);
  }

  backupDomainFallbackRow(): FormItemElement<unknown> {
    const props: ToggleRowProps = {
      title: "Use Backup Domain as Fallback",
      value: getUseBackupDomainFallback(),
      onValueChange: Application.Selector(
        this as ReadComicOnlineSettingsForm,
        "handleBackupDomainFallbackChange",
      ),
    };

    return ToggleRow("backup-domain-fallback", props);
  }

  async handleDomainModeChange(value: string[]): Promise<void> {
    const domainMode = value[0] ?? "main";

    setDomainMode(domainMode);
    if (domainMode === "backup") {
      setUseBackupDomainFallback(false);
    }

    Application.invalidateDiscoverSections();
    this.reloadForm();
  }

  async handleBackupDomainFallbackChange(value: boolean): Promise<void> {
    setUseBackupDomainFallback(value);
    this.reloadForm();
  }
}
