import { Meterable } from "./Meterable";

/**
 * Anything that can be metered by aggregation of meterables
 */
export class MeterableAggregation implements Meterable {

	// Aggregated information
	private z80Timing: number[] = [0, 0];
	private msxTiming: number[] = [0, 0];
	private cpcTiming: number[] = [0, 0];
	private bytes: string[] = [];
	private size: number = 0;

	/**
	 * Adds meterables to the aggregation
	 * @param meterables The Meterable instances to aggregate
	 * @param repeatCount The number of times to add the meterables to the aggregation
	 */
	public addAll(meterables: Meterable[] | undefined, repeatCount: number): void {

		// (sanity check)
		if ((!meterables) || (repeatCount <= 0)) {
			return;
		}

		for (let i = 0; i < repeatCount; i++) {
			meterables.forEach(meterable => this.add(meterable, 1));
		}
	}

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @param repeatCount The number of times to add the meterable to the aggregation
	 */
	public add(meterable: Meterable | undefined, repeatCount: number): void {

		// (sanity check)
		if ((!meterable) || (repeatCount <= 0)) {
			return;
		}

		const instructionZ80Timing = meterable.getZ80Timing();
		this.z80Timing[0] += instructionZ80Timing[0] * repeatCount;
		this.z80Timing[1] += instructionZ80Timing[1] * repeatCount;

		const instructionMsxTiming = meterable.getMsxTiming();
		this.msxTiming[0] += instructionMsxTiming[0] * repeatCount;
		this.msxTiming[1] += instructionMsxTiming[1] * repeatCount;

		const instructionCpcTiming = meterable.getCpcTiming();
		this.cpcTiming[0] += instructionCpcTiming[0] * repeatCount;
		this.cpcTiming[1] += instructionCpcTiming[1] * repeatCount;

		for (let i = 0; i < repeatCount; i++) {
			this.bytes.push(...meterable.getBytes());
		}
		this.size += meterable.getSize() * repeatCount;
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
