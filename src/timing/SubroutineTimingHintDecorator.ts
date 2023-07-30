import { extractMnemonicOf, extractOperandsOf, parseTimingsLenient, parteIntLenient, undefinedIfNaN } from "../utils/utils";
import Meterable from "../model/Meterable";

export default class SubroutineTimingHintDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The repeated meterable instance
	 * @param repeatCount The number of times the meterable instance is repeated
	 * @return The repeated meterable instance, or a repetition of that Meterable,
	 * depending on the value of repeatCount
	 */
	static of(meterable: Meterable | undefined, s: string | undefined): Meterable | undefined {

		// (sanity check)
		if (!meterable) {
			return undefined;
		}
		if (!s) {
			return meterable;
		}

		// Checks timing hint comment
		const matches = s?.matchAll(/\[(ts?|z80|cpc|msx)=(\d+(?:\/\d+)?)\]/g);
		if (!matches) {
			return meterable;
		}

		// Checks instruction
		if (!this.isJumpOrCall(meterable.getInstruction())) {
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
			};
		}

		// Validates timing hint comment
		if (!timingHint && !z80TimingHint && !msxTimingHint && !cpcTimingHint) {
			return meterable;
		}

		return new SubroutineTimingHintDecorator(meterable,
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
		this.conditional = SubroutineTimingHintDecorator.isConditional(meterable.getInstruction());

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

	decompose(): Meterable[] {
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
		return [ "CALL", "JP", "JR", "RST" ].indexOf(mnemonic) !== -1;
	}

	private static isConditional(instruction: string): boolean {

		const operands = extractOperandsOf(instruction);
		return !!operands.length
				&& !!operands[0].match(/^(N?C|N?Z|M|P[OE]?)$/);
	}
}
