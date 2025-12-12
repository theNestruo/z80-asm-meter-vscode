import { config } from "../config";
import type { Meterable } from "../types/Meterable";
import { AtExitTotalTimingsMeterable } from "./impl/AtExitTotalTimingMeterable";
import { DefaultTotalTimingsMeterable } from "./impl/DefaultTotalTimingsMeterable";
import { ExecutionFlowTotalTimingsMeterable } from "./impl/ExecutionFlowTotalTimingsMeterable";
import type { AtExitTotalTiming } from "./types/AtExitTotalTiming";
import type { TotalTiming } from "./types/TotalTiming";

/**
 * Computes and stores:
 * - default total timing,
 * - execution flow total timing, and
 * - execution flow to the selected exit point total timing
 */
export class TotalTimings {

	// (for performance reasons)
	private theDefaultTotalTiming?: TotalTiming;
	private theExecutionFlowTotalTiming?: TotalTiming | null;
	private theAtExitTotalTiming?: AtExitTotalTiming | null;

	constructor(
		private readonly meterable: Meterable) {
	}

	hasNonDefaultTotalTiming(): boolean {
		return !!(this.executionFlowTotalTiming ?? this.atExitTotalTiming);
	}

	/**
	 * @returns the total timings calculations for the status bar,
	 * in the order specified in the extension configuration
	 */
	ordered(): (TotalTiming | undefined)[] {

		// Applies requested order
		const [ret, jumpCall] = this.atExitTotalTiming?.isLastInstructionRet
			? [this.atExitTotalTiming, undefined]
			: [undefined, this.atExitTotalTiming];

		switch (config.statusBar.totalTimingsOrder) {
			case "retFlowJumpCall":
				return [this.defaultTotalTiming, ret, this.executionFlowTotalTiming, jumpCall];

			case "flowRetJumpCall":
				return [this.defaultTotalTiming, this.executionFlowTotalTiming, ret, jumpCall];

			case "retJumpCallFlow":
				return [this.defaultTotalTiming, ret, jumpCall, this.executionFlowTotalTiming];

			default:
				// (should never happen)
				return [this.defaultTotalTiming, undefined, undefined, undefined];
		}
	}

	/**
	 * @returns the total timing calculation that best fits the selection
	 */
	best(): TotalTiming {
		return this.atExitTotalTiming
			?? this.executionFlowTotalTiming
			?? this.defaultTotalTiming;
	}

	/**
	 * @returns the "default total timing" decorator, lazily evaluated
	 */
	get defaultTotalTiming(): TotalTiming {
		return this.theDefaultTotalTiming ??= DefaultTotalTimingsMeterable.calculate(this.meterable);
	}

	/**
	 * @returns The "execution flow timing" decorator, or undefined, lazily evaluated
	 */
	private get executionFlowTotalTiming(): TotalTiming | undefined {
		if (this.theExecutionFlowTotalTiming === undefined) {
			// (uses null when there is no "execution flow timing")
			this.theExecutionFlowTotalTiming = ExecutionFlowTotalTimingsMeterable.calculate(this.meterable) ?? null;
		}
		// (returns undefined instead of null)
		return this.theExecutionFlowTotalTiming ?? undefined;
	}

	/**
	 * @returns the "timing at exit" decorator, or undefined, lazily evaluated
	 */
	private get atExitTotalTiming(): AtExitTotalTiming | undefined {
		if (this.theAtExitTotalTiming === undefined) {
			// (uses null when there is no "timing at exit")
			this.theAtExitTotalTiming = AtExitTotalTimingsMeterable.calculate(this.meterable) ?? null;
		}
		// (returns undefined instead of null)
		return this.theAtExitTotalTiming ?? undefined;
	}
}
