import { Meterable } from "../model/Meterable";
import { TotalTiming, TotalTimingMeterable } from "./TotalTiming";

class DefaultTotalTimingsMeterable extends TotalTimingMeterable {

	constructor(meterable: Meterable) {
		super(meterable);
	}

	get name(): string {
		return "Total timing";
	}

	get description(): string {
		return "Total timing";
	}

	get statusBarIcon(): string {
		return "";
	}

	protected modifiedTimingsOf(timing: number[], _i: number, _n: number, _instruction: string): number[] {
		return timing;
	}
}

class DefaultTotalTiming implements TotalTiming {

	applyTo(meterable: Meterable): TotalTimingMeterable {

		return new DefaultTotalTimingsMeterable(meterable);
	}
}

export const defaultTotalTiming = new DefaultTotalTiming();
