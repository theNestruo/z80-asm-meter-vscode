import { Meterable } from "../model/Meterable";
import { TotalTiming, TotalTimingMeterable } from "./TotalTiming";

class DefaultTotalTimingsMeterable extends TotalTimingMeterable {

	private isAtLeastTwoInstructions: boolean;

	constructor(meterable: Meterable, isAtLeastTwoInstructions: boolean) {
		super(meterable);

		this.isAtLeastTwoInstructions = isAtLeastTwoInstructions;
	}

	get name(): string {
		return this.isAtLeastTwoInstructions ? "Aggregated timing" : "Timing";
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

		// (for performance reasons)
		const meterables = meterable.flatten();

		return new DefaultTotalTimingsMeterable(meterable, meterables.length >= 2);
	}
}

export const defaultTotalTiming = new DefaultTotalTiming();
