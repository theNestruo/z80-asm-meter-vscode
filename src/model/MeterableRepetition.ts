import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A repetition of a Meterables
 */
export default class MeterableRepetition extends AggregatedMeterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The repeated meterable instance
	 * @param repetitions The number of times the meterable instance is repeated
	 * @return The repeated meterable instance, or a repetition of that Meterable,
	 * depending on the value of repetitions
	 */
	static of(meterable: Meterable, repetitions: number): Meterable {

		return repetitions <= 1
				? meterable
				: new MeterableRepetition(meterable, repetitions);
	}

	// The repeated meterable instance
	private meterable: Meterable;

	// The number of times the meterable instance is repeated
	private repetitions: number;

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
	 * @param repetitions The number of times the meterable instance is repeated
	 */
	private constructor(meterable: Meterable, repetitions: number) {
		super();

		this.meterable = meterable;
		this.repetitions = repetitions;
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
					z80Timing[0] * this.repetitions,
					z80Timing[1] * this.repetitions];
		}
		return this.cachedZ80Timing;
	}

	getMsxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const msxTiming = this.meterable.getMsxTiming();
			this.cachedMsxTiming =[
					msxTiming[0] * this.repetitions,
					msxTiming[1] * this.repetitions];
		}
		return this.cachedMsxTiming;
	}

	getCpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const cpcTiming = this.meterable.getCpcTiming();
			this.cachedCpcTiming = [
					cpcTiming[0] * this.repetitions,
					cpcTiming[1] * this.repetitions];
		}
		return this.cachedCpcTiming;
	}

	getBytes(): string[] {

		if (!this.cachedBytes) {
			var bytes: string[] = [];
			for (let i = 0; i < this.repetitions; i++) {
				bytes.push(...this.meterable.getBytes());
			}
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	getSize(): number {

		if (!this.cachedSize) {
			this.cachedSize = this.meterable.getSize() * this.repetitions;
		}
		return this.cachedSize;
	}

	getFlattenedMeterables(): Meterable[] {

		// Nested meterable is simple
		if (!this.meterable.isComposed()) {
			return new Array(this.repetitions).fill(this.meterable);
		}

		// Nested meterable is composed
		const repeatedMeterables = this.meterable.getFlattenedMeterables();
		const meterables = new Array();
		for (let i = 0; i < this.repetitions; i++) {
			meterables.push(...repeatedMeterables);
		}
		return meterables;
	}
}
