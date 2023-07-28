import AggregatedMeterable from "./AggregatedMeterable";
import Meterable from "./Meterable";

/**
 * A meterable collection of Meterables
 */
export default class MeterableCollection extends AggregatedMeterable {

	// The collection of meterable instances
	protected meterables: Meterable[] = [];

	// /**
	//  * Adds meterables to the aggregation
	//  * @param meterables The Meterable instances to aggregate
	//  * @param repeatCount The number of times to add the meterables to the aggregation
	//  * @return true if all the meterable instances were aggregated (at least one); false otherwise
	//  */
	// addAll(meterables: Meterable[] | undefined, repeatCount: number): boolean {

	// 	// (sanity check)
	// 	if ((!meterables) || (repeatCount <= 0)) {
	// 		return false;
	// 	}

	// 	let ret = true;
	// 	for (let i = 0; i < repeatCount; i++) {
	// 		meterables.forEach(meterable => ret &&= this.add(meterable));
	// 	}
	// 	return ret;
	// }

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

	// /**
	//  * Adds a meterable to the aggregation
	//  * @param meterable The Meterable to aggregate
	//  * @param repeatCount The number of times to add the meterable to the aggregation
	//  * @return true if the meterable was aggregated; false otherwise
	//  */
	// add(meterable: Meterable | undefined, repeatCount: number): boolean {

	// 	// (sanity check)
	// 	if ((!meterable) || (repeatCount <= 0)) {
	// 		return false;
	// 	}

	// 	// FIXME
	// 	for (let i = 0; i < repeatCount; i++) {
	// 		this.meterables.push(meterable);
	// 	}
	// 	return true;
	// }

	getInstruction(): string {
		return "";
	}

	getZ80Timing(): number[] {

		var z80Timing: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const instructionZ80Timing = meterable.getZ80Timing();
			z80Timing[0] += instructionZ80Timing[0];
			z80Timing[1] += instructionZ80Timing[1];
		});
		return z80Timing;
	}

	getMsxTiming(): number[] {

		var msxTiming: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const instructionMsxTiming = meterable.getMsxTiming();
			msxTiming[0] += instructionMsxTiming[0];
			msxTiming[1] += instructionMsxTiming[1];
		});
		return msxTiming;
	}

	getCpcTiming(): number[] {

		var cpcTiming: number[] = [0, 0];
		this.meterables.forEach(meterable => {
			const instructionCpcTiming = meterable.getCpcTiming();
			cpcTiming[0] += instructionCpcTiming[0];
			cpcTiming[1] += instructionCpcTiming[1];
		});
		return cpcTiming;
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
