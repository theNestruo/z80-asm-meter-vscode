import type { Meterable } from "../../types/Meterable";
import { AbstractTotalTimingMeterable } from "./AbstractTotalTimingMeterable";

/**
 * "Default total timing" calculation
 */
export class DefaultTotalTimingsMeterable extends AbstractTotalTimingMeterable {

	/**
	 * Builds an instance of the "default total timing" decorator
	 * @param meterable The meterable instance to be decorated
	 * @returns the "default total timing" decorator
	 */
	static calculate(meterable: Meterable): DefaultTotalTimingsMeterable {

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

	readonly statusBarIcon = "";

	protected modifiedTimingsOf(timing: number[], _i: number, _n: number, _instruction: string): number[] {
		return timing;
	}
}
