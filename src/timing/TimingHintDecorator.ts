import Meterable from "../model/Meterable";
import MeterableHint from "../model/MeterableHint";
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../utils/utils";

export default class TimingHintDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The meterable instance
	 * @param meterableHint The timing hints, extracted from the line comments
	 * @param subroutines to apply timing hint only to subroutines
	 * @return The meterable instance, or a hinted meterable instance,
	 * depending on the contents of the line comment
	 */
	static of(meterable: Meterable, meterableHint: MeterableHint, subroutines: boolean): Meterable {

		// Checks instruction
		if (subroutines && (!this.isSubroutineInstruction(meterable.getInstruction()))) {
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

		this.conditional = TimingHintDecorator.isConditionalSubroutineInstruction(meterable.getInstruction());
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

	private static isSubroutineInstruction(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return [ "CALL", "DJNZ", "JP", "JR", "RET", "RETI", "RETN", "RST" ].indexOf(mnemonic) !== -1;
	}

	private static isConditionalSubroutineInstruction(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		const operands = extractOperandsOf(instruction);

		if (!operands.length) {
			return mnemonic === "DJNZ";
		}

		switch (mnemonic) {
		case "CALL":
		case "JP":
		case "RET":
			return isAnyCondition(operands[0]);
		case "JR":
			return isJrCondition(operands[0]);
		default:
			return false;
		}
	}
}
