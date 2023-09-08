import Meterable from "../model/Meterable";

/**
 * @param meterable the Meterable
 * @return the flattened array of the finer-grained meterables,
 * as a queue to be used in first*() and last*() methods
 */
export function flatten(meterable: Meterable): Meterable[] {

	return meterable.isComposed()
		? [...meterable.getFlattenedMeterables()]
		: [meterable];
}
