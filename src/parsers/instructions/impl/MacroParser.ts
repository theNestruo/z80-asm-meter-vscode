import * as vscode from 'vscode';
import { config } from '../../../config';
import { MeterableCollection } from '../../../types/AggregatedMeterables';
import { Meterable } from '../../../types/Meterable';
import { OptionalSingletonRefImpl } from '../../../types/References';
import { SourceCode } from '../../../types/SourceCode';
import { extractMnemonicOf } from '../../../utils/AssemblyUtils';
import { parseTimingsLenient } from "../../../utils/TimingUtils";
import { parteIntLenient } from '../../../utils/NumberUtils';
import { linesToSourceCode } from '../../../utils/SourceCodeUtils';
import { mainParserForMacroParser } from '../../parsers';
import { MacroDefinitionConfiguration } from "../config/MacroDefinitionConfiguration";
import { InstructionParser } from "../types/InstructionParser";

class MacroParserRef extends OptionalSingletonRefImpl<InstructionParser, MacroParser> {

	// Macro maps
	private _definitionByMnemonic?: Record<string, MacroDefinitionConfiguration> = undefined;

	override dispose() {
		this._definitionByMnemonic = undefined;
		super.dispose();
	}

	override onConfigurationChange(e: vscode.ConfigurationChangeEvent) {
		super.onConfigurationChange(e);

        // Forces re-creation on macro definitions change
		if (e.affectsConfiguration("z80-asm-meter.macros")) {
			this.destroyInstance();
			this._definitionByMnemonic = undefined;
		}
	}

	protected get enabled(): boolean {
		return Object.keys(this.definitionByMnemonic).length !== 0;
	}

	protected createInstance(): MacroParser {
		return new MacroParser(this.definitionByMnemonic);
	}

	private get definitionByMnemonic(): Record<string, MacroDefinitionConfiguration> {

		if (this._definitionByMnemonic === undefined) {

			// Initializes macro maps
			const map: Record<string, MacroDefinitionConfiguration> = {};

			// Locates macro definitions
			config.macros?.forEach(macroDefinition => {

				// Prepares a map by mnemonic for performance reasons
				const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
				map[mnemonic] = macroDefinition;
			});

			this._definitionByMnemonic = map;
		}

		return this._definitionByMnemonic;
	}
}

export const macroParser = new MacroParserRef();

//

/**
 * Actual implementation of the macros parser
 */
class MacroParser implements InstructionParser {

	constructor(
		private readonly definitionByMnemonic: Record<string, MacroDefinitionConfiguration>) {
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
	private providedName: string;
	private providedSourceCode: string[];
	private providedZ80Timing?: number[];
	private providedMsxTiming?: number[];
	private providedCpcTiming?: number[];
	private providedSize?: number;

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

		if (this.providedSourceCode) {
			const meterable = mainParserForMacroParser.instance.parse(linesToSourceCode(this.providedSourceCode));
			this.add(meterable);
		}
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
			? new Array(size).fill("n")
			: [];
	}

	/**
	 * @returns The size in bytes
	 */
	override get size(): number {

		return this.providedSize ?? super.size;
	}
}
