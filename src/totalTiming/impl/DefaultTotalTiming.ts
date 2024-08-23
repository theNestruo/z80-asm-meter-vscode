import { Meterable } from "../../types";
import { TotalTimingMeterable } from "../TotalTimingMeterable";

export function calculateDefaultTotalTiming(meterable: Meterable): TotalTimingMeterable {

	// (for performance reasons)
	const meterables = meterable.flatten();

	return new DefaultTotalTimingsMeterable(meterable, meterables.length >= 2);
}

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
