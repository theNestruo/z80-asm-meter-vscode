import Meterable from "../model/Meterable";
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../utils/utils";

export default class AtExitDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of the "last condition met" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "last condition met" decorator, or the original meterable
	 */
	static of(meterable: Meterable): Meterable {

		// Length check
		const meterables: Meterable[] = meterable.isComposed()
				? [ ...meterable.getFlattenedMeterables() ]
				: [ meterable ];
		if (meterables.length < 2) {
			return meterable;
		}

		// Last instruction check
		const instruction = meterables.pop()?.getInstruction();
		if ((!instruction)
			|| (!this.isExitInstruction(instruction))) {
            return meterable;
        }

		// Builds the "last condition met" decorator
		return new AtExitDecorator(meterable);
	}

	// The meterable instance to be decorated
	private decoratedMeterable: Meterable;

    // Derived information (will be cached for performance reasons)
    private cachedZ80Timing: number[] | undefined;
    private cachedMsxTiming: number[] | undefined;
    private cachedCpcTiming: number[] | undefined;
	private cachedMeterables: Meterable[] | undefined;

	private constructor(meterable: Meterable) {

		this.decoratedMeterable = meterable;
	}

	getInstruction(): string {
		return this.decoratedMeterable.getInstruction();
	}

	getZ80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalZ80Timing: number[] = [0, 0];
			meterables.forEach(meterable => {
				const z80Timing = this.modifiedTimingsOf(meterable.getZ80Timing(), i++, n, meterable.getInstruction());
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	getMsxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalMsxTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const msxTiming = this.modifiedTimingsOf(meterable.getMsxTiming(), i++, n, meterable.getInstruction());
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	getCpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const meterables = this.getFlattenedMeterables();
			let i = 0;
			const n = meterables.length;
			var totalCpcTiming: number[] = [0, 0];
			meterables.forEach(meterable => {
				const cpcTiming = this.modifiedTimingsOf(meterable.getCpcTiming(), i++, n, meterable.getInstruction());
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	getBytes(): string[] {
		return this.decoratedMeterable.getBytes();
	}

	getSize(): number {
		return this.decoratedMeterable.getSize();
	}

	isComposed(): boolean {
		return true;
	}

	getFlattenedMeterables(): Meterable[] {

		if (!this.cachedMeterables) {
			this.cachedMeterables = this.decoratedMeterable.isComposed()
					? this.decoratedMeterable.getFlattenedMeterables()
					: [ this.decoratedMeterable ];
		}
		return this.cachedMeterables;
	}

	private modifiedTimingsOf(timing: number[], i: number, n: number, instruction: string): number[] {

		if (!AtExitDecorator.isConditionalJump(instruction)) {
			return timing;
		}

		// Last instruction?
		return (i === n -1)
			? [ timing[0], timing[0] ]	// "Taken" timings
			: [ timing[1], timing[1] ];	// "Not taken" timings
	}

	private static isExitInstruction(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		return [ "JP", "JR", "RET", "RETI", "RETN" ].indexOf(mnemonic) !== -1;
	}

	private static isConditionalJump(instruction: string): boolean {

		const operands = extractOperandsOf(instruction);
		if (!operands.length) {
			return false;
		}

		switch (extractMnemonicOf(instruction)) {
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
