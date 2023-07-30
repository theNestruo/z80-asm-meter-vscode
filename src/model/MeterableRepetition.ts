import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A repetition of a Meterables
 */
export default class MeterableRepetition extends AggregatedMeterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The repeated meterable instance
	 * @param repeatCount The number of times the meterable instance is repeated
	 * @return The repeated meterable instance, or a repetition of that Meterable,
	 * depending on the value of repeatCount
	 */
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

	private constructor(meterable: Meterable, repeatCount: number) {
		super();

		this.meterable = meterable;
		this.repeatCount = repeatCount;
	}

	getInstruction(): string {
		return this.meterable.getInstruction();
	}

	getZ80Timing(): number[] {

		const z80Timing = this.meterable.getZ80Timing();
		return [z80Timing[0] * this.repeatCount,
				z80Timing[1] * this.repeatCount];
	}

	getMsxTiming(): number[] {

		const msxTiming = this.meterable.getMsxTiming();
		return [msxTiming[0] * this.repeatCount,
				msxTiming[1] * this.repeatCount];
	}

	getCpcTiming(): number[] {

		const cpcTiming = this.meterable.getCpcTiming();
		return [cpcTiming[0] * this.repeatCount,
				cpcTiming[1] * this.repeatCount];
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
		return true;
	}

	decompose(): Meterable[] {
		return new Array(this.repeatCount).fill(this.meterable);
	}
}
