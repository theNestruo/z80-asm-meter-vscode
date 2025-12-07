import type * as vscode from "vscode";
import { config } from "../../../config";
import { MeterableCollection } from "../../../types/AggregatedMeterables";
import type { Meterable } from "../../../types/Meterable";
import type { OptionalSingletonRef } from "../../../types/References";
import { OptionalSingletonRefImpl } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import { extractMnemonicOf } from "../../../utils/AssemblyUtils";
import { parteIntLenient } from "../../../utils/NumberUtils";
import { linesToSourceCode } from "../../../utils/SourceCodeUtils";
import { parseTimingsLenient } from "../../../utils/TimingUtils";
import { mainParserForMacroParser } from "../../parsers";
import type { MacroDefinitionConfiguration } from "../config/MacroDefinitionConfiguration";
import type { InstructionParser } from "../types/InstructionParser";

class MacroParserRef extends OptionalSingletonRefImpl<InstructionParser, MacroParser> {

	// Macro maps
	private theDefinitionsByMnemonic?: Record<string, MacroDefinitionConfiguration> = undefined;

	protected get enabled(): boolean {
		return Object.keys(this.definitionsByMnemonic).length !== 0;
	}

	protected createInstance(): MacroParser {
		return new MacroParser(this.definitionsByMnemonic);
	}

	private get definitionsByMnemonic(): Record<string, MacroDefinitionConfiguration> {

		if (this.theDefinitionsByMnemonic === undefined) {

			// Initializes macro definitions
			const map: Record<string, MacroDefinitionConfiguration> = {};
			for (const macroDefinition of config.macros) {

				// Prepares a map by mnemonic for performance reasons
				const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
				map[mnemonic] = macroDefinition;
			}

			this.theDefinitionsByMnemonic = map;
		}

		return this.theDefinitionsByMnemonic;
	}

	protected override onConfigurationChange(e: vscode.ConfigurationChangeEvent): void {
		super.onConfigurationChange(e);

		// Forces re-creation on macro definitions change
		if (e.affectsConfiguration("z80-asm-meter.macros")) {
			this.destroyInstance();
			this.theDefinitionsByMnemonic = undefined;
		}
	}

	override dispose(): void {
		this.theDefinitionsByMnemonic = undefined;
		super.dispose();
	}
}

export const macroParser: OptionalSingletonRef<InstructionParser> = new MacroParserRef();

//

/**
 * Actual implementation of the macros parser
 */
class MacroParser implements InstructionParser {

	constructor(
		private readonly definitionByMnemonic: Record<string, MacroDefinitionConfiguration | undefined>) {
	}

	parseInstruction(s: SourceCode): Meterable | undefined {

		// Locates macro definition
		const mnemonic = extractMnemonicOf(s.instruction);
		const macroDefinition = this.definitionByMnemonic[mnemonic];
		if (!macroDefinition) {
			return undefined;
		}

		return new Macro(macroDefinition);
	}
}

/**
 * A macro
 */
class Macro extends MeterableCollection {

	// User-provided information
	private readonly providedName: string;
	private readonly providedSourceCode: string[];
	private readonly providedZ80Timing?: number[];
	private readonly providedMsxTiming?: number[];
	private readonly providedCpcTiming?: number[];
	private readonly providedSize?: number;

	constructor(source: MacroDefinitionConfiguration) {
		super();

		this.providedName = source.name;
		this.providedSourceCode = source.instructions ?? [];
		this.providedZ80Timing = parseTimingsLenient(source.z80, source.ts, source.t);
		this.providedMsxTiming = (config.platform === "msx")
			? parseTimingsLenient(source.msx, source.m1, source.ts, source.t)
			: parseTimingsLenient(source.m1, source.msx, source.ts, source.t);
		this.providedCpcTiming = parseTimingsLenient(source.cpc, source.ts, source.t);
		this.providedSize = parteIntLenient(source.size);

		const meterable = mainParserForMacroParser.instance.parse(linesToSourceCode(this.providedSourceCode));
		this.add(meterable);
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
		return this.providedZ80Timing ?? super.z80Timing;
	}

	/**
	 * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
	 */
	override get msxTiming(): number[] {
		return this.providedMsxTiming ?? super.msxTiming;
	}

	/**
	 * @returns The CPC timing, in NOPS
	 */
	override get cpcTiming(): number[] {
		return this.providedCpcTiming ?? super.cpcTiming;
	}

	/**
	 * @returns The bytes
	 */
	override get bytes(): string[] {

		const bytes = super.bytes;
		if (bytes.length) {
			return bytes;
		}
		const size = this.size;
		return size
			? Array.from<string>({ length: size }).fill("n")
			: [];
	}

	/**
	 * @returns The size in bytes
	 */
	override get size(): number {

		return this.providedSize ?? super.size;
	}
}
