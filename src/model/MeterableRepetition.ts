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

    // Derived information (will be cached for performance reasons)
    private cachedInstruction: string | undefined;
    private cachedZ80Timing: number[] | undefined;
    private cachedMsxTiming: number[] | undefined;
    private cachedCpcTiming: number[] | undefined;
    private cachedBytes: string[] | undefined;
    private cachedSize: number | undefined;

	/**
	 * Constructor
	 * @param meterable The repeated meterable instance
	 * @param repeatCount The number of times the meterable instance is repeated
	 */
	private constructor(meterable: Meterable, repeatCount: number) {
		super();

		this.meterable = meterable;
		this.repeatCount = repeatCount;
	}

	getInstruction(): string {

		if (!this.cachedInstruction) {
			this.cachedInstruction = this.meterable.getInstruction();
		}
		return this.cachedInstruction;
	}

	getZ80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const z80Timing = this.meterable.getZ80Timing();
			this.cachedZ80Timing = [
					z80Timing[0] * this.repeatCount,
					z80Timing[1] * this.repeatCount];
		}
		return this.cachedZ80Timing;
	}

	getMsxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const msxTiming = this.meterable.getMsxTiming();
			this.cachedMsxTiming =[
					msxTiming[0] * this.repeatCount,
					msxTiming[1] * this.repeatCount];
		}
		return this.cachedMsxTiming;
	}

	getCpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const cpcTiming = this.meterable.getCpcTiming();
			this.cachedCpcTiming = [
					cpcTiming[0] * this.repeatCount,
					cpcTiming[1] * this.repeatCount];
		}
		return this.cachedCpcTiming;
	}

	getBytes(): string[] {

		if (!this.cachedBytes) {
			var bytes: string[] = [];
			for (let i = 0; i < this.repeatCount; i++) {
				bytes.push(...this.meterable.getBytes());
			}
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	getSize(): number {

		if (!this.cachedSize) {
			this.cachedSize = this.meterable.getSize() * this.repeatCount;
		}
		return this.cachedSize;
	}

	getFlattenedMeterables(): Meterable[] {

		// Nested meterable is simple
		if (!this.meterable.isComposed()) {
			return new Array(this.repeatCount).fill(this.meterable);
		}

		// Nested meterable is composed
		const repeatedMeterables = this.meterable.getFlattenedMeterables();
		const meterables = new Array();
		for (let i = 0; i < this.repeatCount; i++) {
			meterables.push(...repeatedMeterables);
		}
		return meterables;
	}
}
