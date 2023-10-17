import { AbstractAggregatedMeterable, Meterable } from "./Meterable";

/**
 * A meterable collection of Meterables
 */
export class MeterableCollection extends AbstractAggregatedMeterable {

	// The collection of meterable instances
	protected meterables: Meterable[] = [];

    // Derived information (will be cached for performance reasons)
    private cachedZ80Timing: number[] | undefined;
    private cachedMsxTiming: number[] | undefined;
    private cachedCpcTiming: number[] | undefined;
    private cachedBytes: string[] | undefined;
    private cachedSize: number | undefined;
	private cachedMeterables: Meterable[] | undefined;

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @return true if the meterable was aggregated; false otherwise
	 */
	add(meterable: Meterable | undefined): boolean {

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
			let totalZ80Timing: number[] = [0, 0];
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
			let totalMsxTiming: number[] = [0, 0];
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
			let totalCpcTiming: number[] = [0, 0];
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
			let bytes: string[] = [];
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
			let meterables: Meterable[] = [];
			this.meterables.forEach(meterable => {
				if (meterable.composed) {
					meterables.push(...meterable.flatten());
				} else {
					meterables.push(meterable);
				}
			});
			this.cachedMeterables = meterables;
		}
		return this.cachedMeterables;
	}

	isEmpty(): boolean {
		return !this.flatten().length;
	}
}
