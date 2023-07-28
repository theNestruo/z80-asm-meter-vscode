import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A meterable collection of Meterables
 */
export default class MeterableCollection extends AggregatedMeterable {

	getInstruction(): string {
		return "";
	}

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

		// FIXME
		for (let i = 0; i < repeatCount; i++) {
			this.meterables.push(meterable);
		}
		return true;
	}
}
