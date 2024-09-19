import * as vscode from 'vscode';

class Configuration {

	get languageIds(): string[] {
		return configurationReader.read("languageIds");
	}

	get platform(): "z80" | "cpc" | "msx" | "pc8000" | "z80n" {
		return configurationReader.read("platform");
	}

	get instructionSets(): string[] {

		return this.platform === "z80n"
			? ["S", "N"]
			: ["S"];
	}

	get expandSelectionToLine(): boolean {

		return configurationReader.read("expandSelectionToLine");
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
		return configurationReader.read("macros");
	}

	// Inlay hints
	readonly inlayHints = new InlayHintsConfiguration();
}

class StatusBarConfiguration {

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

class SyntaxConfiguration {

	get syntax(): "default" | "glass" | "pasmo" | "sjasm" | "sjasmplus" | "spasm-ng" | "tniasm" {
		return configurationReader.read("syntax");
	}

	private get lineSeparator(): "disabled" | "backslash" | "colon" | "pipe" {

		return configurationReader.readWithDefaultValue("syntaxFeature.lineSeparator",
			this.syntax === "spasm-ng" ? "backslash" // (derived)
			: this.syntax === "tniasm" ? "pipe" // (derived)
			: undefined);
	}

	get lineSeparatorCharacter(): string | undefined {

		const value = this.lineSeparator;
		return value === "backslash" ? "\\"
			: value === "colon" ? ":"
			: value === "pipe" ? "|"
			: undefined;
	}

	private get labelColonOptional(): boolean {

		const value = this.syntax;
		return configurationReader.readWithDefaultValue("syntaxFeature.labelColonOptional",
			value === "pasmo" ? true // (derived)
			: value === "sjasmplus" ? true // (derived)
			: undefined);
	}

	get labelRegExp(): RegExp {

		return this.labelColonOptional
			? /(^[^\s:]+(?:[\s:]|$))/
			: /(^\s*[^\s:]+:)/;
	}

	private get repeat(): "disabled" | "brackets" | "dot"{

		return configurationReader.readWithDefaultValue("syntaxFeature.repeat",
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

	get sjasmplusFakeInstructions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.fakeInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get sjasmplusRegisterListInstructions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.registerListInstructions",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get glassNegativeConditions(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.negativeConditions",
			(this.syntax === "glass") ? true // (derived)
			: undefined);
	}

	get sjasmplusDupEdupRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.dupEdup",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get sjasmplusReptEndrRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.reptEndr",
			(this.syntax === "sjasmplus") ? true // (derived)
			: undefined);
	}

	get glassReptEndmRepetition(): boolean {

		return configurationReader.readWithDefaultValue("syntaxFeature.reptendm",
			(this.syntax === "glass") ? true // (derived)
			: undefined);
	}
}

class ParserConfiguration {

	get directivesDefsAsInstructions(): boolean {
		return configurationReader.read("parser.directives.defsAsInstructions");
	}

	get instructionsCacheSize(): number {
		return configurationReader.read("parser.instructionsCacheSize");
	}
}

class TimingConfiguration {

	readonly hints = new TimingHintsConfiguration();
	readonly executionFlow = new ExecutionFlowTotalTimingConfiguration();
	readonly atExit = new AtExitTotalTimingConfiguration();
}

class TimingHintsConfiguration {

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
	get regexps(): TimingHintsDefinition[] {
		return configurationReader.read("timing.hints.regexps");
	}
}

class ExecutionFlowTotalTimingConfiguration {

	get enabled(): boolean {
		return configurationReader.read("timing.executionFlow.enabled");
	}

	get threshold(): number {
		return configurationReader.read("timing.executionFlow.threshold");
	}

	get requireConditional(): boolean {
		return configurationReader.read("timing.executionFlow.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return configurationReader.read("timing.executionFlow.stopOnUnconditionalJump");
	}

	get icon(): string {
		return configurationReader.read("timing.executionFlow.icon");
	}
}

class AtExitTotalTimingConfiguration {

	get retEnabled(): boolean {
		return configurationReader.read("timing.atExit.retEnabled");
	}

	get jumpEnabled(): boolean {
		return configurationReader.read("timing.atExit.jumpEnabled");
	}

	get callEnabled(): boolean {
		return configurationReader.read("timing.atExit.callEnabled");
	}

	get threshold(): number {
		return configurationReader.read("timing.atExit.threshold");
	}

	get requireConditional(): boolean {
		return configurationReader.read("timing.atExit.requireConditional");
	}

	get stopOnUnconditionalJump(): boolean {
		return configurationReader.read("timing.atExit.stopOnUnconditionalJump");
	}

	get retIcon(): string {
		return configurationReader.read("timing.atExit.retIcon");
	}

	get jumpIcon(): string {
		return configurationReader.read("timing.atExit.jumpIcon");
	}

	get callIcon(): string {
		return configurationReader.read("timing.atExit.callIcon");
	}
}

class InlayHintsConfiguration {

	get enabled(): boolean {
		return configurationReader.read("inlayHints.enabled");
	}

	get subroutinesPosition(): "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "lineEnd" {
		return configurationReader.read("inlayHints.subroutines.position");
	}

	get unlabelledSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.unlabelled");
	}

	get nestedSubroutines(): "disabled" | "enabled" | "entryPoint" {
		return configurationReader.read("inlayHints.subroutines.nested");
	}

	get fallthroughSubroutines(): boolean {
		return configurationReader.read("inlayHints.subroutines.fallthrough");
	}

	get exitPointPosition(): "lineStart" | "afterLabel" | "beforeCode" | "afterCode" | "beforeComment" | "lineEnd" {
		return configurationReader.read("inlayHints.exitPoint.position");
	}

	get exitPointRet(): boolean {
		return configurationReader.read("inlayHints.exitPoint.ret");
	}

	get exitPointJp(): boolean {
		return configurationReader.read("inlayHints.exitPoint.jp");
	}

	get exitPointJr(): boolean {
		return configurationReader.read("inlayHints.exitPoint.jr");
	}

	get exitPointDjnz(): boolean {
		return configurationReader.read("inlayHints.exitPoint.djnz");
	}

	get exitPointLabel(): "first" | "closest" {
		return configurationReader.read("inlayHints.exitPoint.label");
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

class SimpleConfigurationReader {

	read<T>(section: string): T {

		return <T>vscode.workspace.getConfiguration("z80-asm-meter").get(section);
	}

	readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}
		return <T>this.readIgnoreDefault(section) ?? actualDefaultValue;
	}

	private readIgnoreDefault<T>(section: string): T | undefined {

		const config = vscode.workspace.getConfiguration("z80-asm-meter");
		const info = config.inspect(section);
		const isSet = info
			&& (info.globalValue
				|| info.workspaceValue
				|| info.workspaceFolderValue
				|| info.defaultLanguageValue
				|| info.globalLanguageValue
				|| info.workspaceLanguageValue
				|| info.workspaceFolderLanguageValue);
		return isSet ? <T>config.get(section) : undefined;
	}
}

class CachedConfigurationReader extends SimpleConfigurationReader {

    private readonly disposable: vscode.Disposable;

	private cache = new Map<string, any>();

    constructor() {
		super();

		// Subscribe to configuration change event
		this.disposable = vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
    }

	dispose() {
        this.disposable.dispose();
	}

	onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {
		this.cache.clear();
	}

	override read<T>(section: string): T {

		if (this.cache.has(section)) {
			return this.cache.get(section);
		}

		const value: T = super.read(section);
		this.cache.set(section, value);
		return value;
	}

	override readWithDefaultValue<T>(section: string, actualDefaultValue: T | undefined): T {

		if (actualDefaultValue === undefined) {
			return this.read(section);
		}

		if (this.cache.has(section)) {
			return this.cache.get(section);
		}

		const value: T = super.readWithDefaultValue(section, actualDefaultValue);
		this.cache.set(section, value);
		return value;
	}
}

export const configurationReader = new CachedConfigurationReader();

export const config = new Configuration();
