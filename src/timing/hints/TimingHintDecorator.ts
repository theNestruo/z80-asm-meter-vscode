import Meterable from "../../model/Meterable";
import { isConditionalInstruction, isJumpOrCallInstruction } from "../../utils/AssemblyUtils";
import MeterableHint from "./model/MeterableHint";

export default class TimingHintsDecorator implements Meterable {

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
		if (subroutines && (!isJumpOrCallInstruction(meterable.getInstruction()))) {
			return meterable;
		}

		return new TimingHintsDecorator(meterable, meterableHint);
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

		this.conditional = isConditionalInstruction(meterable.getInstruction());
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
}
