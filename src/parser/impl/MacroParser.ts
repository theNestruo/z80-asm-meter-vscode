import * as vscode from 'vscode';
import { MacroDefinition, config } from "../../config";
import { Meterable, MeterableCollection } from "../../model/Meterables";
import { SourceCode } from "../../model/SourceCode";
import { extractMnemonicOf } from "../../utils/AssemblyUtils";
import { parteIntLenient } from "../../utils/NumberUtils";
import { parseTimingLenient } from "../../utils/TimingUtils";
import { noMacroMainParser } from "../MainParser";
import { InstructionParser } from "../Parsers";

class Macro extends MeterableCollection {

	// User-provided information
	private providedName: string;
	private providedSourceCode: string | undefined;
	private providedZ80Timing: number[] | undefined;
	private providedMsxTiming: number[] | undefined;
	private providedCpcTiming: number[] | undefined;
	private providedSize: number | undefined;

	// Derived information (will be cached for performance reasons)
	private ready: boolean = false;

	constructor(source: MacroDefinition) {
		super();

		this.providedName = source.name;
		this.providedSourceCode = source.instructions?.join("\n");
		this.providedZ80Timing =
			parseTimingLenient(source.z80)
			|| parseTimingLenient(source.ts)
			|| parseTimingLenient(source.t);
		this.providedMsxTiming = config.platform === "msx"
			? (parseTimingLenient(source.msx)
				|| parseTimingLenient(source.m1)
				|| parseTimingLenient(source.ts)
				|| parseTimingLenient(source.t))
			: (parseTimingLenient(source.m1)
				|| parseTimingLenient(source.msx)
				|| parseTimingLenient(source.ts)
				|| parseTimingLenient(source.t));
		this.providedCpcTiming =
			parseTimingLenient(source.cpc)
			|| parseTimingLenient(source.ts)
			|| parseTimingLenient(source.t);
		this.providedSize = parteIntLenient(source.size);

		this.init();
	}

	/** false; this meterable is not composed */
	override readonly composed = false;

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
			const meterable = noMacroMainParser.parse(this.providedSourceCode);
			this.add(meterable);
		}

		this.ready = true;
	}
}

class MacroParser implements InstructionParser {

	// Macro maps
	private definitionByMnemonic: Record<string, MacroDefinition>;

	constructor() {
		this.definitionByMnemonic = this.reloadDefinitions();
	}

	onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

		if (e.affectsConfiguration("z80-asm-meter.macros")) {
			this.definitionByMnemonic = this.reloadDefinitions();
		}
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

	get isEnabled(): boolean {
		return Object.keys(this.definitionByMnemonic).length !== 0;
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

export const macroParser = new MacroParser();

