import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A meterable collection of Meterables
 */
export default class MeterableCollection extends AggregatedMeterable {

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

	getInstruction(): string {
		return "";
	}

	getZ80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			var totalZ80Timing: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const z80Timing = meterable.getZ80Timing();
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	getMsxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			var totalMsxTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const msxTiming = meterable.getMsxTiming();
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	getCpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			var totalCpcTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const cpcTiming = meterable.getCpcTiming();
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	getBytes(): string[] {

		if (!this.cachedBytes) {
			var bytes: string[] = [];
			this.meterables.forEach(meterable => bytes.push(...meterable.getBytes()));
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	getSize(): number {

		if (!this.cachedSize) {
			var size: number = 0;
			this.meterables.forEach(meterable => size += meterable.getSize());
			this.cachedSize = size;
		}
		return this.cachedSize;
	}

	decompose(): Meterable[] {

		if (!this.cachedMeterables?.length) {
			var flattenedMeterables: Meterable[] = [];
			this.meterables.forEach(meterable => {
				if (meterable.isComposed()) {
					flattenedMeterables.push(...meterable.decompose());
				} else {
					flattenedMeterables.push(meterable);
				}
			});
			this.cachedMeterables = flattenedMeterables;
		}
		return this.cachedMeterables;
	}
}
