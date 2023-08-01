import Meterable from "../model/Meterable";
import MeterableHint from "../model/MeterableHint";
import { extractMnemonicOf, extractOperandsOf, parseTimingsLenient } from "../utils/utils";

export default class TimingHintDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The meterable instance
	 * @param rawComment The line comment; can contain timing hints
	 * @return The meterable instance, or a hinted meterable instance,
	 * depending on the contents of the line comment
	 */
	static of(meterable: Meterable | undefined, meterableHint: MeterableHint | undefined,
		subroutines: boolean): Meterable | undefined {

		// (sanity check)
		if ((!meterable) || (!meterableHint)) {
			return meterable;
		}

		// Checks instruction
		if (subroutines && (!this.isJumpOrCall(meterable.getInstruction()))) {
			return meterable;
		}

		return new TimingHintDecorator(meterable, meterableHint);
	}

	// The meterable instance
	private meterable: Meterable;

	// The hinted meterable instance
	private meterableHint: MeterableHint;

    // Information
	private conditional: boolean;

	private constructor(meterable: Meterable, meterableHint: MeterableHint) {

		this.meterable = meterable;
		this.meterableHint = meterableHint;

		this.conditional = TimingHintDecorator.isConditional(meterable.getInstruction());
	}

	getInstruction(): string {
		return this.meterable.getInstruction();
	}

	getZ80Timing(): number[] {

		return this.modifiedTimingsOf(this.meterable.getZ80Timing(), this.meterableHint.getZ80Timing());
	}

	getMsxTiming(): number[] {

		return this.modifiedTimingsOf(this.meterable.getMsxTiming(), this.meterableHint.getMsxTiming());
	}

	getCpcTiming(): number[] {

		return this.modifiedTimingsOf(this.meterable.getCpcTiming(), this.meterableHint.getCpcTiming());
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
