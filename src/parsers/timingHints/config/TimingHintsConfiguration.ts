import { configurationReader } from "../../../vscode/ConfigurationReader";
import type { TimingHintsDefinitionConfiguration } from "./TimingHintsDefinitionConfiguration";

type timingHintsEnabledType = "disabled" | "subroutines" | "any" | "ignoreCommentedOut";

export class TimingHintsConfiguration {

	get enabledValue(): timingHintsEnabledType {
		return configurationReader.read("timing.hints.enabled");
	}

	get enabled(): boolean {

		const value = this.enabledValue;
		return value === "subroutines"
			|| value === "any"
			|| value === "ignoreCommentedOut";
	}

	// RegExp-based user-defined timing hints
	get regexps(): TimingHintsDefinitionConfiguration[] {
		return configurationReader.read("timing.hints.regexps");
	}
}
