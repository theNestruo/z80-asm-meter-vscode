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

	isComposed(): boolean {
		return true;
	}

	abstract decompose(): Meterable[];
}
