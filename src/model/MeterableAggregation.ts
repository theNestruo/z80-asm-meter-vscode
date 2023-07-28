import Meterable from "./Meterable";

/**
 * Anything that can be metered by aggregation of meterables
 */
export default class MeterableAggregation implements Meterable {

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
	 * @return true if all the meterable instances were aggregated (at least one); false otherwise
	 */
	addAll(meterables: Meterable[] | undefined, repeatCount: number): boolean {

		// (sanity check)
		if ((!meterables) || (repeatCount <= 0)) {
			return false;
		}

		let ret = true;
		for (let i = 0; i < repeatCount; i++) {
			meterables.forEach(meterable => ret &&= this.add(meterable, 1));
		}
		return ret;
	}

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @param repeatCount The number of times to add the meterable to the aggregation
	 * @return true if the meterable was aggregated; false otherwise
	 */
	add(meterable: Meterable | undefined, repeatCount: number): boolean {

		// (sanity check)
		if ((!meterable) || (repeatCount <= 0)) {
			return false;
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

		return true;
	}

	getInstruction(): string {
		return "";
	}

	getZ80Timing(): number[] {
		return this.z80Timing;
	}

	getMsxTiming(): number[] {
		return this.msxTiming;
	}

	getCpcTiming(): number[] {
		return this.cpcTiming;
	}

	getBytes(): string[] {
		return this.bytes;
	}

	getSize(): number {
		return this.size;
	}

	isComposed(): boolean {
		return false; // FIXME
	}

	decompose(): Meterable[] | undefined {
		return undefined; // FIXME
	}
}
