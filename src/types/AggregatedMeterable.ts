import { Meterable } from "./Meterable";

/**
 * Any aggregation of meterables
 */
abstract class AggregatedMeterable implements Meterable {

	abstract get instruction(): string;

	abstract get z80Timing(): number[];

	abstract get msxTiming(): number[];

	abstract get cpcTiming(): number[];

	abstract get bytes(): string[];

	abstract get size(): number;

	/**
	 * @returns the flattened array of the finer-grained meterables that compose this meterable
	 */
	abstract flatten(): Meterable[];

	/** true; this meterable is composed */
	isComposed = true;
}
/**
 * A collection of Meterables as a single Meterable
 */

export class MeterableCollection extends AggregatedMeterable {

	// The collection of meterable instances
	protected meterables: Meterable[] = [];

	// Derived information (will be cached for performance reasons)
	private cachedZ80Timing?: number[];
	private cachedMsxTiming?: number[];
	private cachedCpcTiming?: number[];
	private cachedBytes?: string[];
	private cachedSize?: number;
	private cachedMeterables?: Meterable[];

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @return true if the meterable was aggregated; false otherwise
	 */
	add(meterable?: Meterable): boolean {

		// (sanity check)
		if (!meterable) {
			return false;
		}

		this.meterables.push(meterable);

		this.cachedZ80Timing = undefined;
		this.cachedMsxTiming = undefined;
		this.cachedCpcTiming = undefined;
		this.cachedBytes = undefined;
		this.cachedSize = undefined;
		this.cachedMeterables = undefined;

		return true;
	}

	get instruction(): string {
		return "";
	}

	get z80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const totalZ80Timing: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const z80Timing = meterable.z80Timing;
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	get msxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const totalMsxTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const msxTiming = meterable.msxTiming;
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	get cpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const totalCpcTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const cpcTiming = meterable.cpcTiming;
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	get bytes(): string[] {

		if (!this.cachedBytes) {
			const bytes: string[] = [];
			this.meterables.forEach(meterable => bytes.push(...meterable.bytes));
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	get size(): number {

		if (!this.cachedSize) {
			let size: number = 0;
			this.meterables.forEach(meterable => size += meterable.size);
			this.cachedSize = size;
		}
		return this.cachedSize;
	}

	flatten(): Meterable[] {

		if (!this.cachedMeterables?.length) {
			const meterables: Meterable[] = [];
			this.meterables.forEach(meterable => {
				if (meterable.isComposed) {
					meterables.push(...meterable.flatten());
				} else {
					meterables.push(meterable);
				}
			});
			this.cachedMeterables = meterables;
		}
		return this.cachedMeterables;
	}
}

/**
 * A repetition of a Meterables as a single Meterable
 */

export class RepeatedMeterable extends AggregatedMeterable {

	/**
	 * Conditionaly builds an instance of a repetition of Meterables
	 * @param meterable The repeated meterable instance
	 * @param repetitions The number of times the meterable instance is repeated
	 * @return The repeated meterable instance, or a repetition of that Meterable,
	 * depending on the value of repetitions
	 */
	public static of(meterable: Meterable, repetitions: number): Meterable {

		return repetitions <= 1
			? meterable
			: new RepeatedMeterable(meterable, repetitions);
	}

	// Derived information (will be cached for performance reasons)
	private cachedInstruction?: string;
	private cachedZ80Timing?: number[];
	private cachedMsxTiming?: number[];
	private cachedCpcTiming?: number[];
	private cachedBytes?: string[];
	private cachedSize?: number;

	/**
	 * Constructor
	 * @param meterable The repeated meterable instance
	 * @param repetitions The number of times the meterable instance is repeated
	 */
	constructor(
		private meterable: Meterable,
		private repetitions: number) {
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
				z80Timing[1] * this.repetitions
			];
		}
		return this.cachedZ80Timing;
	}

	get msxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const msxTiming = this.meterable.msxTiming;
			this.cachedMsxTiming = [
				msxTiming[0] * this.repetitions,
				msxTiming[1] * this.repetitions
			];
		}
		return this.cachedMsxTiming;
	}

	get cpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const cpcTiming = this.meterable.cpcTiming;
			this.cachedCpcTiming = [
				cpcTiming[0] * this.repetitions,
				cpcTiming[1] * this.repetitions
			];
		}
		return this.cachedCpcTiming;
	}

	get bytes(): string[] {

		if (!this.cachedBytes) {
			const bytes: string[] = [];
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
		if (!this.meterable.isComposed) {
			return new Array(this.repetitions).fill(this.meterable);
		}

		// Nested meterable is composed
		const repeatedMeterables = this.meterable.flatten();
		const meterables = [];
		for (let i = 0; i < this.repetitions; i++) {
			meterables.push(...repeatedMeterables);
		}
		return meterables;
	}
}

