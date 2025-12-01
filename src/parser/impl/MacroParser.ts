import * as vscode from 'vscode';
import { MacroDefinition, config } from "../../config";
import { Meterable, MeterableCollection, SourceCode } from "../../types";
import { extractMnemonicOf } from "../../utils/AssemblyUtils";
import { parseTimingsLenient, parteIntLenient } from "../../utils/ParserUtils";
import { linesToSourceCode } from '../../utils/SourceCodeUtils';
import { mainParserWithoutMacro } from "../MainParser";
import { InstructionParser } from "../Parsers";
import { LazyOptionalSingleton } from '../../utils/Lifecycle';

class MacroParserSingleton extends LazyOptionalSingleton<MacroParser> {

	// Macro maps
	private definitionByMnemonic: Record<string, MacroDefinition> = {};

	override activate(context: vscode.ExtensionContext): void {
		super.activate(context);

		context.subscriptions.push(
			// Subscribe to configuration change event
			vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this)
		);

        // Initializes definitions
		this.definitionByMnemonic = this.reloadDefinitions();
	}

	override dispose() {
		this.definitionByMnemonic = {};
		super.dispose();
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

		// Re-initializes definitions
		if (e.affectsConfiguration("z80-asm-meter.macros")) {
			this.definitionByMnemonic = this.reloadDefinitions();
		}
	}

	protected override get enabled(): boolean {
		return Object.keys(this.definitionByMnemonic).length !== 0;
	}

	protected override createInstance(): MacroParser {
		return new MacroParser(this.definitionByMnemonic);
	}

	private reloadDefinitions(): Record<string, MacroDefinition> {

		// Initializes macro maps
		const map: Record<string, MacroDefinition> = {};

		// Locates macro definitions
		config.macros?.forEach(macroDefinition => {

			// Prepares a map by mnemonic for performance reasons
			const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
			map[mnemonic] = macroDefinition;
		});

		return map;
	}
}

class MacroParser implements InstructionParser {

	constructor(
		private readonly definitionByMnemonic: Record<string, MacroDefinition>) {
	}

	parse(s: SourceCode): Meterable | undefined {

		// Locates macro definition
		const mnemonic = extractMnemonicOf(s.instruction);
		const macroDefinition = this.definitionByMnemonic[mnemonic];
		if (!macroDefinition) {
			return undefined;
		}

		return new Macro(macroDefinition);
	}
}

class Macro extends MeterableCollection {

	// User-provided information
	private providedName: string;
	private providedSourceCode: string[];
	private providedZ80Timing?: number[];
	private providedMsxTiming?: number[];
	private providedCpcTiming?: number[];
	private providedSize?: number;

	// Derived information (will be cached for performance reasons)
	private ready: boolean = false;

	constructor(source: MacroDefinition) {
		super();

		this.providedName = source.name;
		this.providedSourceCode = source.instructions ?? [];
		this.providedZ80Timing = parseTimingsLenient(source.z80, source.ts, source.t);
		this.providedMsxTiming = (config.platform === "msx")
			? parseTimingsLenient(source.msx, source.m1, source.ts, source.t)
			: parseTimingsLenient(source.m1, source.msx, source.ts, source.t);
		this.providedCpcTiming = parseTimingsLenient(source.cpc, source.ts, source.t);
		this.providedSize = parteIntLenient(source.size);

		this.init();
	}

	/** false; this meterable is not composed */
	override readonly isComposed = false;

	/**
	 * @returns The name of the macro
	 */
	override get instruction(): string {

		return this.providedName;
	}

	/**
	 * @returns The Z80 timing, in time (T) cycles
	 */
	override get z80Timing(): number[] {

		if (this.providedZ80Timing) {
			return this.providedZ80Timing;
		}
		this.init();
		return super.z80Timing;
	}

	/**
	 * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
	 */
	override get msxTiming(): number[] {

		if (this.providedMsxTiming) {
			return this.providedMsxTiming;
		}
		this.init();
		return super.msxTiming;
	}

	/**
	 * @returns The CPC timing, in NOPS
	 */
	override get cpcTiming(): number[] {

		if (this.providedCpcTiming) {
			return this.providedCpcTiming;
		}
		this.init();
		return super.cpcTiming;
	}

	/**
	 * @returns The bytes
	 */
	override get bytes(): string[] {

		this.init();
		const bytes = super.bytes;
		if (bytes.length) {
			return bytes;
		}
		const size = this.size;
		return size
			? new Array(size).fill("n")
			: [];
	}

	/**
	 * @returns The size in bytes
	 */
	override get size(): number {

		if (this.providedSize) {
			return this.providedSize;
		}
		return super.size;
	}

	private init(): void {

		// (sanity check)
		if (this.ready) {
			return;
		}

		if (this.providedSourceCode) {
			const meterable = mainParserWithoutMacro.instance.parse(linesToSourceCode(this.providedSourceCode));
			this.add(meterable);
		}

		this.ready = true;
	}
}

export const macroParser = new MacroParserSingleton();

