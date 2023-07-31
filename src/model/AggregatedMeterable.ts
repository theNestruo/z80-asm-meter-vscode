import Meterable from "./Meterable";

/**
 * Anything that can be metered by aggregation of meterables
 */
export default abstract class AggregatedMeterable implements Meterable {

	abstract getInstruction(): string;

	abstract getZ80Timing(): number[];

	abstract getMsxTiming(): number[];

	abstract getCpcTiming(): number[];

	abstract getBytes(): string[];

	abstract getSize(): number;

	/**
	 * @returns true; this meterable is composed
	 */
	isComposed(): boolean {
		return true;
	}

	/**
	 * @returns the flattened array of the finer-grained meterables that compose this meterable
	 */
	abstract getFlattenedMeterables(): Meterable[];
}
