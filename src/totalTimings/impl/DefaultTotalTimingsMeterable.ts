import { Meterable } from "../../types/Meterable";
import { AbstractTotalTimingMeterable } from "./AbstractTotalTimingMeterable";

export class DefaultTotalTimingsMeterable extends AbstractTotalTimingMeterable {

	public static calculate(meterable: Meterable): DefaultTotalTimingsMeterable {

		// (for performance reasons)
		const meterables = meterable.flatten();

		return new DefaultTotalTimingsMeterable(meterable, meterables.length >= 2);
	}

	private constructor(
		meterable: Meterable,
		private readonly isAtLeastTwoInstructions: boolean) {

		super(meterable);
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
