import { extractMnemonicOf, extractOperandsOf, parseTimingsLenient, parteIntLenient, undefinedIfNaN } from "../utils/utils";
import Meterable from "../model/Meterable";

export default class TimingHintDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The meterable instance
	 * @param rawComment The line comment; can contain timing hints
	 * @return The meterable instance, or a hinted meterable instance,
	 * depending on the contents of the line comment
	 */
	static of(meterable: Meterable | undefined, rawComment: string | undefined,
		subroutines: boolean): Meterable | undefined {

		// (sanity check)
		if (!meterable) {
			return undefined;
		}
		if (!rawComment) {
			return meterable;
		}

		// Checks timing hint comment
		const matches = rawComment?.matchAll(/\[(ts?|z80|cpc|msx)\s*=\s*((?:\-\s*)?\d+(?:\/(?:\-\s*)?\d+)?)\]/g);
		if (!matches) {
			return meterable;
		}

		// Parses timing hint comment
		var timingHint: number[] | undefined = undefined;
		var z80TimingHint: number[] | undefined = undefined;
		var msxTimingHint: number[] | undefined = undefined;
		var cpcTimingHint: number[] | undefined = undefined;
		for (const match of matches) {
			const parsedTimingHint = parseTimingsLenient(match[2]);
			if (!parsedTimingHint) {
				continue;
			}

			switch (match[1]) {
				case "t":
				case "ts":
					timingHint = parsedTimingHint;
					break;
				case "z80":
					z80TimingHint = parsedTimingHint;
					break;
				case "cpc":
					cpcTimingHint = parsedTimingHint;
					break;
				case "msx":
					msxTimingHint = parsedTimingHint;
					break;
			}
		}

		// Validates timing hint comment
		if (!timingHint && !z80TimingHint && !msxTimingHint && !cpcTimingHint) {
			return meterable;
		}

		// Checks instruction
		if (subroutines && (!this.isJumpOrCall(meterable.getInstruction()))) {
			return meterable;
		}

		return new TimingHintDecorator(meterable,
				timingHint, z80TimingHint, msxTimingHint, cpcTimingHint);
	}

	// The hinted meterable instance
	private meterable: Meterable;

    // Information
	private conditional: boolean;
	private timingHint: number[] | undefined = undefined;
    private z80TimingHint: number[] | undefined = undefined;
    private msxTimingHint: number[] | undefined = undefined;
    private cpcTimingHint: number[] | undefined = undefined;

	private constructor(meterable: Meterable,
			timingHint: number[] | undefined, z80TimingHint: number[] | undefined,
			msxTimingHint: number[] | undefined, cpcTimingHint: number[] | undefined) {

		this.meterable = meterable;
		this.conditional = TimingHintDecorator.isConditional(meterable.getInstruction());

		this.timingHint = timingHint;
		this.z80TimingHint = z80TimingHint;
		this.msxTimingHint = msxTimingHint;
		this.cpcTimingHint = cpcTimingHint;
	}

	getInstruction(): string {
		return this.meterable.getInstruction();
	}

	getZ80Timing(): number[] {

		return this.modifiedTimingsOf(this.meterable.getZ80Timing(), this.z80TimingHint || this.timingHint);
	}

	getMsxTiming(): number[] {

		return this.modifiedTimingsOf(this.meterable.getMsxTiming(), this.msxTimingHint || this.timingHint);
	}

	getCpcTiming(): number[] {

		return this.modifiedTimingsOf(this.meterable.getCpcTiming(), this.cpcTimingHint || this.timingHint);
	}

	getBytes(): string[] {

		return this.meterable.getBytes();
	}

	getSize(): number {

		return this.meterable.getSize();
	}

	isComposed(): boolean {
		return false;
	}

	getFlattenedMeterables(): Meterable[] {
		return [];
	}

	private modifiedTimingsOf(timing: number[], addend: number[] | undefined): number[] {

		// (sanity check)
		if (!addend) {
			return timing;
		}

		// Conditional instruction?
		return this.conditional
			? [ timing[0] + addend[0], timing[1] ]
			: [ timing[0] + addend[0], timing[1] + addend[1] ];
	}

	private static isJumpOrCall(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return [ "CALL", "DJNZ", "JP", "JR", "RET", "RST" ].indexOf(mnemonic) !== -1;
	}

	private static isConditional(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		if (mnemonic === "DJNZ") {
			return true;
		}

		const operands = extractOperandsOf(instruction);
		return !!operands.length
				&& !!operands[0].match(/^(N?C|N?Z|M|P[OE]?)$/);
	}
}
