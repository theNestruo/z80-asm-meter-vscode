import Meterable from "../model/Meterable";
import { extractMnemonicOf, extractOperandsOf } from "../utils/utils";

export default class AtExitDecorator implements Meterable {

	/**
	 * Conditionaly builds an instance of the "last condition met" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "last condition met" decorator, or the original meterable
	 */
	static of(meterable: Meterable | undefined): Meterable | undefined {

		// (sanity check)
		if (!meterable) {
			return undefined;
		}

		// Length check
		const meterables: Meterable[] = meterable.isComposed()
				? meterable.decompose()
				: [ meterable ];
		if (meterables.length < 2) {
			return meterable;
		}

		// Last instruction check
		const instruction = meterables.pop()?.getInstruction();
		if (!instruction) {
			return meterable;
		}
		const mnemonic = extractMnemonicOf(instruction);
        if ([ "JP", "JR", "RET" ].indexOf(mnemonic) === -1) {
            return meterable;
        }

		// Builds the "last condition met" decorator
		return new AtExitDecorator(meterable);
	}

	// The meterable instance to be decorated
	private decoratedMeterable: Meterable;

	private constructor(meterable: Meterable) {

		this.decoratedMeterable = meterable;
	}

	getInstruction(): string {
		return this.decoratedMeterable.getInstruction();
	}

	getZ80Timing(): number[] {

		const meterables = this.decompose();
		let i = 0;
		const n = meterables.length;
		var totalZ80Timing: number[] = [0, 0];
		meterables.forEach(meterable => {
			const z80Timing = this.modifiedTimingsOf(meterable.getZ80Timing(), i++, n, meterable.getInstruction());
			totalZ80Timing[0] += z80Timing[0];
			totalZ80Timing[1] += z80Timing[1];
		});
		return totalZ80Timing;
	}

	getMsxTiming(): number[] {

		const meterables = this.decompose();
		let i = 0;
		const n = meterables.length;
		var totalMsxTiming: number[] = [0, 0];
		meterables.forEach(meterable => {
			const msxTiming = this.modifiedTimingsOf(meterable.getMsxTiming(), i++, n, meterable.getInstruction());
			totalMsxTiming[0] += msxTiming[0];
			totalMsxTiming[1] += msxTiming[1];
		});
		return totalMsxTiming;
	}

	getCpcTiming(): number[] {

		const meterables = this.decompose();
		let i = 0;
		const n = meterables.length;
		var totalCpcTiming: number[] = [0, 0];
		meterables.forEach(meterable => {
			const cpcTiming = this.modifiedTimingsOf(meterable.getCpcTiming(), i++, n, meterable.getInstruction());
			totalCpcTiming[0] += cpcTiming[0];
			totalCpcTiming[1] += cpcTiming[1];
		});
		return totalCpcTiming;
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

	decompose(): Meterable[] {
		return this.decoratedMeterable.isComposed()
				? this.decoratedMeterable.decompose()
				: [ this.decoratedMeterable ];
	}

	private modifiedTimingsOf(timing: number[], i: number, n: number, instruction: string): number[] {

		if (!this.isConditionalJump(instruction)) {
			return timing;
		}
		return (i === n -1)
			? [ timing[0], timing[0] ]
			: [ timing[1], timing[1] ];
	}

	private isConditionalJump(instruction: string): boolean {

		const mnemonic = extractMnemonicOf(instruction);
		if ([ "JP", "JR", "RET" ].indexOf(mnemonic) === -1) {
			return false;
		}
		const operands = extractOperandsOf(instruction);
		return !!operands.length
				&& !!operands[0].match(/^(N?C|N?Z|M|P[OE]?)$/);
	}
}
