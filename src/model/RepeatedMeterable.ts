import { AbstractAggregatedMeterable, Meterable } from "./Meterable";

/**
 * Conditionaly builds an instance of a repetition of Meterables
 * @param meterable The repeated meterable instance
 * @param repetitions The number of times the meterable instance is repeated
 * @return The repeated meterable instance, or a repetition of that Meterable,
 * depending on the value of repetitions
 */
export function repeatedMeterable(meterable: Meterable, repetitions: number): Meterable {

	return repetitions <= 1
			? meterable
			: new RepeatedMeterable(meterable, repetitions);
}

/**
 * A repetition of a Meterables
 */
class RepeatedMeterable extends AbstractAggregatedMeterable {

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
	constructor(meterable: Meterable, repetitions: number) {
		super();

		this.meterable = meterable;
		this.repetitions = repetitions;
	}

	get instruction(): string {

		if (!this.cachedInstruction) {
			this.cachedInstruction = this.meterable.instruction;
		}
		return this.cachedInstruction;
	}

	get z80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const z80Timing = this.meterable.z80Timing;
			this.cachedZ80Timing = [
					z80Timing[0] * this.repetitions,
					z80Timing[1] * this.repetitions];
		}
		return this.cachedZ80Timing;
	}

	get msxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const msxTiming = this.meterable.msxTiming;
			this.cachedMsxTiming =[
					msxTiming[0] * this.repetitions,
					msxTiming[1] * this.repetitions];
		}
		return this.cachedMsxTiming;
	}

	get cpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const cpcTiming = this.meterable.cpcTiming;
			this.cachedCpcTiming = [
					cpcTiming[0] * this.repetitions,
					cpcTiming[1] * this.repetitions];
		}
		return this.cachedCpcTiming;
	}

	get bytes(): string[] {

		if (!this.cachedBytes) {
			let bytes: string[] = [];
			for (let i = 0; i < this.repetitions; i++) {
				bytes.push(...this.meterable.bytes);
			}
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	get size(): number {

		if (!this.cachedSize) {
			this.cachedSize = this.meterable.size * this.repetitions;
		}
		return this.cachedSize;
	}

	flatten(): Meterable[] {

		// Nested meterable is simple
		if (!this.meterable.composed) {
			return new Array(this.repetitions).fill(this.meterable);
		}

		// Nested meterable is composed
		const repeatedMeterables = this.meterable.flatten();
		const meterables = new Array();
		for (let i = 0; i < this.repetitions; i++) {
			meterables.push(...repeatedMeterables);
		}
		return meterables;
	}
}
