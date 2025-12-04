import { configurationReader } from "../ConfigurationReader";

export class StatusBarConfiguration {

	get alignment(): "leftmost" | "left" | "right" | "rightmost" {
		return configurationReader.read("statusBar.alignment");
	}

	get showInstruction(): boolean {
		return configurationReader.read("statusBar.showInstruction");
	}

	get showBytes(): boolean {
		return configurationReader.read("statusBar.showBytes");
	}

	get copyTimingsAsHints(): boolean {
		return configurationReader.read("statusBar.copyTimingsAsHints");
	}

	get sizeNumericFormat(): "decimal" | "hexadecimal" | "both" {
		return configurationReader.read("statusBar.sizeNumericFormat");
	}

	get sizeHexadecimalFormat(): "hash" | "motorola" | "intel" | "intelUppercase" | "cStyle" | "uppercaseHash" | "uppercaseMotorola" | "uppercaseIntel" | "uppercaseIntelUppercase" | "uppercaseCStyle" {
		return configurationReader.read("statusBar.sizeHexadecimalFormat");
	}

	get sizeSuffix(): string {
		return configurationReader.read("statusBar.sizeSuffix");
	}

	get totalTimings(): "all" | "combineAll" | "smart" | "combineSmart" | "best" | "default" {
		return configurationReader.read("statusBar.totalTimings");
	}

	get totalTimingsEnabled(): boolean {
		return this.totalTimings !== "default";
	}

	get totalTimingsCombined(): boolean {

		const value = this.totalTimings;
		return value === "combineAll"
			|| value === "combineSmart";
	}

	get totalTimingsOrder(): "retFlowJumpCall" | "flowRetJumpCall" | "retJumpCallFlow" {
		return configurationReader.read("statusBar.totalTimingsOrder");
	}

	get debounce(): number {
		return configurationReader.read("statusBar.debounce");
	}

	get cacheSize(): number {
		return configurationReader.read("statusBar.cacheSize");
	}

	get instructionIcon(): string {
		return configurationReader.read("statusBar.instructionIcon");
	}

	get timingsIcon(): string {
		return configurationReader.read("statusBar.timingsIcon");
	}

	get sizeIcon(): string {
		return configurationReader.read("statusBar.sizeIcon");
	}
}
