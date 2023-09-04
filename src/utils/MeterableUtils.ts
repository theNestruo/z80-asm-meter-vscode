import Meterable from "../model/Meterable";

/**
 * @param metered the Meterable
 * @return the flattened array of the finer-grained meterables,
 * as a queue to be used in first*() and last*() methods
 */
export function flatten(metered: Meterable): Meterable[] {

	return metered.isComposed()
		? [...metered.getFlattenedMeterables()]
		: [metered];
}
