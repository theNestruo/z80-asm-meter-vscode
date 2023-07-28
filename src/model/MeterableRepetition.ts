import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A repetition of a Meterables
 */
export default class MeterableRepetition extends AggregatedMeterable {

	static of(meterable: Meterable | undefined, repeatCount: number): Meterable | undefined {

		// (sanity check)
		if (!meterable) {
			return undefined;
		}

		return repeatCount <= 1
				? meterable
				: new MeterableRepetition(meterable, repeatCount);
	}

	// The repeated meterable instance
	private meterable: Meterable;

	// The number of times the meterable instance is repeated
	private repeatCount: number;

	constructor(meterable: Meterable, repeatCount: number) {
		super();

		this.meterable = meterable;
		this.repeatCount = repeatCount;
	}

	getInstruction(): string {
		return this.meterable.getInstruction();
	}

	getZ80Timing(): number[] {

		const instructionZ80Timing = this.meterable.getZ80Timing();
		return [instructionZ80Timing[0] * this.repeatCount,
				instructionZ80Timing[1] * this.repeatCount];
	}

	getMsxTiming(): number[] {

		const instructionMsxTiming = this.meterable.getMsxTiming();
		return [instructionMsxTiming[0] * this.repeatCount,
				instructionMsxTiming[1] * this.repeatCount];
	}

	getCpcTiming(): number[] {

		const instructionCpcTiming = this.meterable.getCpcTiming();
		return [instructionCpcTiming[0] * this.repeatCount,
				instructionCpcTiming[1] * this.repeatCount];
	}

	getBytes(): string[] {

		var bytes: string[] = [];
		for (let i = 0; i < this.repeatCount; i++) {
			bytes.push(...this.meterable.getBytes());
		}
		return bytes;
	}

	getSize(): number {

		return this.meterable.getSize() * this.repeatCount;
	}

	isComposed(): boolean {
		return false; // (for performance reasons)
	}

	decompose(): Meterable[] {

		return [];
		// (for performance reasons, instead of:
		// return new Array(this.repeatCount).fill(this.meterable);
		// )
	}
}
