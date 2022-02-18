import { Meterable } from "./Meterable";

/**
 * Anything that can be metered composed by an aggregation of meterables
 */
export class MeterableCollection implements Meterable {

	// The aggregated meterable instances
	private meterables: Meterable[] = [];

	// Derived information (will be cached for performance reasons)
	private z80Timing: number[] = [0, 0];
	private msxTiming: number[] = [0, 0];
	private cpcTiming: number[] = [0, 0];
	private bytes: string[] = [];
	private size: number = 0;

	/**
	 * @returns The aggregated meterable instances
	 */
	public getMeterables(): Meterable[] {
		return this.meterables;
	}

	/**
	 * Adds meterables to the aggregation
	 * @param meterables The Meterable instances to aggregate
	 */
	public addAll(meterables: Meterable[] | undefined): void {

		// (sanity check)
		if (!meterables) {
			return;
		}

		meterables.forEach(meterable => this.add(meterable));
	}

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 */
	public add(meterable: Meterable | undefined): void {

		// (sanity check)
		if (!meterable) {
			return;
		}
		// if (meterable instanceof MeterableCollection) {
		// 	this.meterables.push(...meterable.getMeterables());
		// } else {
			this.meterables.push(meterable);
		// }

		const instructionZ80Timing = meterable.getZ80Timing();
		this.z80Timing[0] += instructionZ80Timing[0];
		this.z80Timing[1] += instructionZ80Timing[1];

		const instructionMsxTiming = meterable.getMsxTiming();
		this.msxTiming[0] += instructionMsxTiming[0];
		this.msxTiming[1] += instructionMsxTiming[1];

		const instructionCpcTiming = meterable.getCpcTiming();
		this.cpcTiming[0] += instructionCpcTiming[0];
		this.cpcTiming[1] += instructionCpcTiming[1];

		this.bytes.push(...meterable.getBytes());
		this.size += meterable.getSize();
	}

	/**
	 * @returns The empty string
	 */
	public getInstruction(): string {
		return "";
	}

	/**
	 * @returns The Z80 timing, in time (T) cycles
	 */
	public getZ80Timing(): number[] {
		return this.z80Timing;
	}

	/**
	 * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
	 */
	public getMsxTiming(): number[] {
		return this.msxTiming;
	}

	/**
	 * @returns The CPC timing, in NOPS
	 */
	public getCpcTiming(): number[] {
		return this.cpcTiming;
	}

	/**
	 * @returns The bytes
	 */
	public getBytes(): string[] {
		return this.bytes;
	}

	/**
	 * @returns The size in bytes
	 */
	public getSize(): number {
		return this.size;
	}
}