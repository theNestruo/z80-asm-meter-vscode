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
	const info = config.inspect(section);
	if ((info?.defaultValue !== undefined)
		&& (info?.defaultValue !== "default")) {
		const a = actualDefaultValue;
	}

	if (actualDefaultValue === undefined) {
		return read(section);
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

	get expandSelectionToLine(): boolean {

		return read("expandSelectionToLine");
	}

	// Status bar
	readonly statusBar = new StatusBarConfiguration();

	// Assembler syntax
	readonly syntax = new SyntaxConfiguration();

	// Parser
	readonly parser = new ParserConfiguration();

	// Total timing calculation and Timing Hints
	readonly timing = new TimingConfiguration();

	// User-defined macros
	get macros(): MacroDefinition[] {
		return read("macros");
	}
}


class SyntaxConfiguration {

	get syntax(): "default" | "glass" | "pasmo" | "sjasm" | "sjasmplus" | "tniasm" {
		return read("syntax");
	}

	private get lineSeparatorValue(): "none" | "colon" | "pipe" {

		return readWithDefaultValue("syntax.lineSeparator",
			this.syntax === "tniasm" ? "pipe" // (derived)
			: undefined);
	}

	get lineSeparator(): string | undefined {

		const value = this.lineSeparatorValue;
		return value === "colon" ? ":"
			: value === "pipe" ? "|"
			: undefined;
	}

	private get labelColonOptional(): boolean {

		const value = this.syntax;
		return readWithDefaultValue("syntax.label.colonOptional",
			value === "pasmo" ? true // (derived)
			: value === "sjasmplus" ? true // (derived)
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

		const value = this.repeat;
		return value === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
			: value === "dot" ? /^(?:\.(\S+)\s)(.+)$/
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
		return read("parser.directives.defsAsInstructions");
	}
}

class TimingConfiguration {

	readonly hints = new TimingHintsConfiguration();
	readonly executionFlow = new ExecutionFlowTotalTimingConfiguration();
	readonly atExit = new AtExitTotalTimingConfiguration();
}

class TimingHintsConfiguration {

	get enabledValue(): "none" | "subroutines" | "any" | "ignoreCommentedOut" {
		return read("timing.hints.enabled");
	}

	get enabled(): boolean {

		const value = this.enabledValue;
		return value === "subroutines"
			|| value === "any"
			|| value === "ignoreCommentedOut";
	}

	// RegExp-based user-defined timing hints
	get regexps(): TimingHintsDefinition[] {
		return read("timing.hints.regexps");
	}
}

class ExecutionFlowTotalTimingConfiguration {

	get enabled(): boolean {
		return read("timing.executionFlow.enabled");
	}

	get threshold(): number {
		return read("timing.executionFlow.threshold");
	}

	get requireConditional(): boolean {
		return read("timing.executionFlow.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return read("timing.executionFlow.stopOnUnconditionalJump");
	}

	get icon(): string {
		return read("timing.executionFlow.icon");
	}
}

class AtExitTotalTimingConfiguration {

	get retEnabled(): boolean {
		return read("timing.atExit.retEnabled");
	}

	get jumpEnabled(): boolean {
		return read("timing.atExit.jumpEnabled");
	}

	get callEnabled(): boolean {
		return read("timing.atExit.callEnabled");
	}

	get threshold(): number {
		return read("timing.atExit.threshold");
	}

	get requireConditional(): boolean {
		return read("timing.atExit.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return read("timing.atExit.stopOnUnconditionalJump");
	}

	get retIcon(): string {
		return read("timing.atExit.retIcon");
	}

	get jumpIcon(): string {
		return read("timing.atExit.jumpIcon");
	}

	get callIcon(): string {
		return read("timing.atExit.callIcon");
	}
}

class StatusBarConfiguration {

	get alignment(): "leftmost" | "left" | "right" | "rightmost" {
		return read("statusBar.alignment");
	}

	get showInstruction(): boolean {
		return read("statusBar.showInstruction");
	}

	get showBytes(): boolean {
		return read("statusBar.showBytes");
	}

	get copyTimingsAsHints(): boolean {
		return read("statusBar.copyTimingsAsHints");
	}

	get sizeSuffix(): string {
		return read("statusBar.sizeSuffix");
	}

	get totalTimings(): "all" | "combineAll" | "smart" | "combineSmart" | "best" | "default" {
		return read("statusBar.totalTimings");
	}

	get totalTimingsEnabled(): boolean {
		return this.totalTimings !== "default";
	}

	get totalTimingsCombined() {

		const value = this.totalTimings;
		return value === "combineAll"
			|| value === "combineSmart";
	}

	get totalTimingsOrder(): "retFlowJumpCall" | "flowRetJumpCall" | "retJumpCallFlow" {
		return read("statusBar.totalTimingsOrder");
	}

	get debounce(): number {
		return read("statusBar.debounce");
	}

	get instructionIcon(): string {
		return read("statusBar.instructionIcon");
	}

	get timingsIcon(): string {
		return read("statusBar.timingsIcon");
	}

	get sizeIcon(): string {
		return read("statusBar.sizeIcon");
	}
}

/**
 * User-defined macro
 */
export interface MacroDefinition {

	/**
	 * The name of the macro
	 */
	name: string;

	/**
	 * The macro definition, as instructions for the macro (optional)
	 */
	instructions: string[] | undefined;

	/**
	 * Declares or overrides Z80 default macro timing (optional)
	 */
	z80: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	msx: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	m1: number | string | undefined;

	/**
	 * Declares or overrides macro timing measured in number of NOPs (optional)
	 */
	cpc: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	ts: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	t: number | string | undefined;

	/**
	 * Declares or overrides macro byte count (optional)
	 */
	size: number | string | undefined;
}

/**
 * RegExp-based user-defined timing hints
 */
export interface TimingHintsDefinition {

	/**
	 * The pattern of the regular expression to match against the line comment
	 */
	pattern: RegExp;

	/**
	 * The string indicating the flags of the regular expression
	 */
	flags: string | undefined;

	/**
	 * Declares or overrides Z80 default macro timing (optional)
	 */
	z80: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	msx: number | string | undefined;

	/**
	 * Declares or overrides Z80+M1 macro timing information (MSX standard) (optional)
	 */
	m1: number | string | undefined;

	/**
	 * Declares or overrides macro timing measured in number of NOPs (optional)
	 */
	cpc: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	ts: number | string | undefined;

	/**
	 * Declares or overrides default macro timing (optional)
	 */
	t: number | string | undefined;
}

export const config = new Configuration();
