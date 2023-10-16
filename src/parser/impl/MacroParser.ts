import { ConfigurationChangeEvent, workspace } from "vscode";
import { config } from "../../config";
import { Meterable } from "../../model/Meterable";
import { MeterableCollection } from "../../model/MeterableCollection";
import { SourceCode } from "../../model/SourceCode";
import { extractMnemonicOf } from "../../utils/AssemblyUtils";
import { parteIntLenient } from "../../utils/NumberUtils";
import { parseTimingLenient } from "../../utils/TimingUtils";
import { MainParser } from "../MainParser";
import { InstructionParser } from "../Parsers";

export class MacroParser implements InstructionParser {

	// Singleton
	static instance = new MacroParser();

	// Macro maps
	private definitionByMnemonic: Record<string, MacroDefinition>;

	private constructor() {
		this.definitionByMnemonic = this.reloadDefinitions();
	}

	onConfigurationChange(e: ConfigurationChangeEvent) {

		// Reloads caches for "heavy" configurations
		if (e.affectsConfiguration("z80-asm-meter.macros")) {
			this.definitionByMnemonic = this.reloadDefinitions();
		}
	}

	private reloadDefinitions(): Record<string, MacroDefinition> {

		// Initializes macro maps
		const macroDefinitionByMnemonic: Record<string, MacroDefinition> = {};

		// Locates macro definitions
		const configuration = workspace.getConfiguration("z80-asm-meter");
		const macroDefinitions: MacroDefinition[] = configuration.get("macros", []);
		macroDefinitions.forEach(macroDefinition => {

			// Prepares a map by mnemonic for performance reasons
			const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
			macroDefinitionByMnemonic[mnemonic] = macroDefinition;
		});

		return macroDefinitionByMnemonic;
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

/**
 * An user-defined macro, as defined in extension settings
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

export class Macro extends MeterableCollection {

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

	/**
	 * @returns The name of the macro
	 */
	get instruction(): string {

		return this.providedName;
	}

	/**
	 * @returns The Z80 timing, in time (T) cycles
	 */
	getZ80Timing(): number[] {

		if (this.providedZ80Timing) {
			return this.providedZ80Timing;
		}
		this.init();
		return super.z80Timing;
	}

	/**
	 * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
	 */
	getMsxTiming(): number[] {

		if (this.providedMsxTiming) {
			return this.providedMsxTiming;
		}
		this.init();
		return super.msxTiming;
	}

	/**
	 * @returns The CPC timing, in NOPS
	 */
	getCpcTiming(): number[] {

		if (this.providedCpcTiming) {
			return this.providedCpcTiming;
		}
		this.init();
		return super.cpcTiming;
	}

	/**
	 * @returns The bytes
	 */
	getBytes(): string[] {

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
	getSize(): number {

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
			const meterable = MainParser.noMacroInstance.parse(this.providedSourceCode);
			this.add(meterable);
		}

		this.ready = true;
	}
}
