import * as vscode from 'vscode';

function read<T>(section: string): T {

	return <T>vscode.workspace.getConfiguration("z80-asm-meter").get(section);
}

function readIgnoreDefault<T>(section: string): T | undefined {

	const config = vscode.workspace.getConfiguration("z80-asm-meter");
	const info = config.inspect(section);
	const isSet = info && (info.globalValue !== undefined
		|| info.workspaceValue !== undefined
		|| info.workspaceFolderValue !== undefined
		|| info.defaultLanguageValue !== undefined
		|| info.globalLanguageValue !== undefined
		|| info.workspaceLanguageValue !== undefined
		|| info.workspaceFolderLanguageValue !== undefined);
	return isSet ? <T>config.get(section) : undefined;
}

function readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

	const config = vscode.workspace.getConfiguration("z80-asm-meter");
	if (actualDefaultValue === undefined) {
		return <T>config.get(section);
	}
	const value = <T>readIgnoreDefault(section);
	return (value !== undefined) ? value : actualDefaultValue;
}

class Configuration {

	get languageIds(): string[] {

		return read("languageIds");
	}

	get platform(): "z80" | "cpc" | "msx" | "pc8000" | "z80n" {

		return read("platform");
	}

	get instructionSets(): string[] {

		return this.platform === "z80n"
			? ["S", "N"]
			: ["S"];
	}

	readonly syntax = new SyntaxConfiguration();

	readonly parser = new ParserConfiguration();

	readonly timing = new TimingConfiguration();

	readonly statusBar = new StatusBarConfiguration();
}


class SyntaxConfiguration {

	get syntax(): "default" | "glass" | "pasmo" | "sjasm" | "sjasmplus" | "tniasm" {

		return readWithDefaultValue("syntax",
			<boolean>read("sjasmplus") ? "sjasmplus" // (deprecated)
			: undefined);
	}

	private get lineSeparatorValue(): "none" | "colon" | "pipe" {

		return readWithDefaultValue("syntax.lineSeparator",
			(this.syntax === "tniasm") ? "pipe" // (derived)
			: undefined);
	}

	get lineSeparator(): string | undefined {

		return this.lineSeparatorValue === "colon" ? ":"
			: this.lineSeparatorValue === "pipe" ? "|"
			: undefined;
	}

	private get labelColonOptional(): boolean {

		const deprecatedValue = readIgnoreDefault("syntax.label");
		return readWithDefaultValue("syntax.label.colonOptional",
			(deprecatedValue !== undefined) ? (deprecatedValue === "colonOptional") // (deprecated)
			: (this.syntax === "pasmo") ? true // (derived)
			: (this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get labelRegExp(): RegExp {

		return this.labelColonOptional
			? /(^[^\s:]+([\s:]|$))/
			: /(^\s*[^\s:]+:)/;
	}

	private get repeat(): "none" | "brackets" | "dot" {

		return readWithDefaultValue("syntax.repeat",
			(this.syntax === "sjasm") ? "brackets" // (derived)
				: (this.syntax === "sjasmplus") ? "dot" // (derived)
					: undefined);
	}

	get repeatRegExp(): RegExp | undefined {

		return this.repeat === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
			: this.repeat === "dot" ? /^(?:\.(\S+)\s)(.+)$/
			: undefined;
	}

	get sjasmplusFakeInstructionEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.fakeInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get sjasmplusRegisterListInstructionEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.registerListInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get glassNegativeConditionsEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.negativeConditions",
			(this.syntax === "glass") ? true // (derived)
			: undefined);
	}

	get sjasmplusDupEdupRepetitionEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.dupEdup",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get sjasmplusReptEndrEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.reptEndr",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get glassReptEndmEnabled(): boolean {

		return readWithDefaultValue("syntax.enable.reptendm",
			(this.syntax === "glass") ? true // (derived)
			: undefined);
	}
}

class ParserConfiguration {

	get directivesDefsAsInstructions(): boolean {

		const deprecatedValue = <string>readIgnoreDefault("directivesAsInstructions");
		return readWithDefaultValue("parser.directives.defsAsInstructions",
			(deprecatedValue !== undefined) ? (deprecatedValue === "defs") // (deprecated)
			: undefined);
	}
}

class TimingConfiguration {

	readonly hints = new TimingHintsConfiguration();

	readonly executionFlow = new ExecutionFlowTotalTimingConfiguration();

	readonly atExit = new AtExitTotalTimingConfiguration();
}

class TimingHintsConfiguration {

	get enabled(): boolean {

		const deprecatedValue = <string>readIgnoreDefault("timing.hints");
		return readWithDefaultValue("timing.hints.enabled",
			(deprecatedValue !== undefined) ? (deprecatedValue !== "none") // (deprecated)
			: undefined);
	}

	get lenient(): boolean {

		const deprecatedValue = <string>readIgnoreDefault("timing.hints");
		return readWithDefaultValue("timing.hints.enabled",
			(deprecatedValue === "any") ? "lenient" // (deprecated)
			: undefined) === "lenient";
	}
}

class ExecutionFlowTotalTimingConfiguration {

	get enabled(): boolean {

		return read("timing.executionFlow.enabled");
	}

	get threshold(): number {

		return readWithDefaultValue("timing.executionFlow.threshold",
			readIgnoreDefault("timing.threshold")); // (deprecated)
	}

	get requireConditional(): boolean {

		return read("timing.executionFlow.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {

		return read("timing.executionFlow.stopOnUnconditionalJump");
	}
}

class AtExitTotalTimingConfiguration {

	get enabled(): boolean {

		return read("timing.atExit.enabled");
	}

	get threshold(): number {

		return readWithDefaultValue("timing.atExit.threshold",
			readIgnoreDefault("timing.threshold")); // (deprecated)
	}

	get requireConditional(): boolean {

		return read("timing.atExit.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {

		return read("timing.atExit.stopOnUnconditionalJump");
	}
}

class StatusBarConfiguration {

	get alignment(): "leftmost" | "left" | "right" | "rightmost" {

		return read("statusBar.alignment");
	}

	get showInstruction(): boolean {

		return readWithDefaultValue("statusBar.showInstruction",
			readIgnoreDefault("viewInstruction")); // (deprecated)
	}

	get showBytes(): boolean {

		return readWithDefaultValue("statusBar.showBytes",
			readIgnoreDefault("viewBytes")); // (deprecated)
	}

	get compactSize(): boolean {

		return read("statusBar.compactSize");
	}

	get totalTimings(): boolean | "best" | "combine" | "combineSmart" | "smart" {

		const deprecatedValue = readIgnoreDefault("timing.mode");
		return readWithDefaultValue("statusBar.totalTimings",
			deprecatedValue === "none" ? false // (deprecated)
			: deprecatedValue === "best" ? "best" // (deprecated)
			: deprecatedValue === "smart" ? "combineSmart" // (deprecated)
			: deprecatedValue === "all" ? "combine" // (deprecated)
			: undefined);
	}

	get totalTimingsCombined() {

		return this.totalTimings === "combine"
			|| this.totalTimings === "combineSmart";
	}

	get debounce(): number {

		return readWithDefaultValue("statusBar.debounce",
			readIgnoreDefault("debounce")); // (deprecated)
	}
}

const instance = new Configuration();
export { instance as config };
