import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A meterable collection of Meterables
 */
export default class MeterableCollection extends AggregatedMeterable {

	// The collection of meterable instances
	protected meterables: Meterable[] = [];

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
		return true;
	}

	getInstruction(): string {
		return "";
	}

	getZ80Timing(): number[] {

		var totalZ80Timing: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const z80Timing = meterable.getZ80Timing();
			totalZ80Timing[0] += z80Timing[0];
			totalZ80Timing[1] += z80Timing[1];
		});
		return totalZ80Timing;
	}

	getMsxTiming(): number[] {

		var totalMsxTiming: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const msxTiming = meterable.getMsxTiming();
			totalMsxTiming[0] += msxTiming[0];
			totalMsxTiming[1] += msxTiming[1];
		});
		return totalMsxTiming;
	}

	getCpcTiming(): number[] {

		var totalCpcTiming: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const cpcTiming = meterable.getCpcTiming();
			totalCpcTiming[0] += cpcTiming[0];
			totalCpcTiming[1] += cpcTiming[1];
		});
		return totalCpcTiming;
	}

	getBytes(): string[] {

		var bytes: string[] = [];
		this.meterables.forEach(meterable => bytes.push(...meterable.getBytes()));
		return bytes;
	}

	getSize(): number {

		var size: number = 0;
		this.meterables.forEach(meterable => size += meterable.getSize());
		return size;
	}

	decompose(): Meterable[] {

		var flattenedMeterables: Meterable[] = [];
		this.meterables.forEach(meterable => {
			if (meterable.isComposed()) {
				flattenedMeterables.push(...meterable.decompose());
			} else {
				flattenedMeterables.push(meterable);
			}
		});
		return flattenedMeterables;
	}
}
