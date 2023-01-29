import { Meterable } from "./Meterable";
import { MeterableAggregation } from "./MeterableAggregation";

/**
 * Anything that can be metered composed by an aggregation of actual meterables
 */
export class MeterableCollection extends MeterableAggregation {

	// The aggregated meterable instances
	private meterables: Meterable[] = [];

	/**
	 * @returns The aggregated meterable instances
	 */
	public getMeterables(): Meterable[] {
		return this.meterables;
	}

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @param repeatCount The number of times to add the meterable to the aggregation
	 */
	public add(meterable: Meterable | undefined, repeatCount: number): void {

		// (sanity check)
		if (!meterable) {
			return;
		}

		if (meterable instanceof MeterableCollection) {
			for (let i = 0; i < repeatCount; i++) {
				this.meterables.push(...meterable.getMeterables());
			}
		} else {
			for (let i = 0; i < repeatCount; i++) {
				this.meterables.push(meterable);
			}
		}

		super.add(meterable, repeatCount);
	}
}
