import { Meterable } from "../model/Meterable";
import { TotalTiming, TotalTimingMeterable } from "./TotalTiming";

export class DefaultTotalTiming implements TotalTiming {

    // Singleton
    static instance = new DefaultTotalTiming();

	private constructor() {}

	applyTo(meterable: Meterable): TotalTimingMeterable {

		return new DefaultTotalTimingsMeterable(meterable);
	}
}

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
