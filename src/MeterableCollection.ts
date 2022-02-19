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
	 */
	public add(meterable: Meterable | undefined): void {

		// (sanity check)
		if (!meterable) {
			return;
		}

		if (meterable instanceof MeterableCollection) {
			this.meterables.push(...meterable.getMeterables());
		} else {
			this.meterables.push(meterable);
		}

		super.add(meterable);
	}
}