import { configurationReader } from "../../../vscode/ConfigurationReader";
import { TimingHintsDefinitionConfiguration } from "./TimingHintsDefinitionConfiguration";

export class TimingHintsConfiguration {

	get enabledValue(): "disabled" | "subroutines" | "any" | "ignoreCommentedOut" {
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
