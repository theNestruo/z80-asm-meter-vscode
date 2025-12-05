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

	readonly defaultTotalTiming: TotalTiming;
	readonly executionFlowTotalTiming?: TotalTiming;
	readonly atExitTotalTiming?: AtExitTotalTiming;

	constructor(meterable: Meterable) {

		this.defaultTotalTiming = DefaultTotalTimingsMeterable.calculate(meterable);
		this.executionFlowTotalTiming = ExecutionFlowTotalTimingsMeterable.calculate(meterable);
		this.atExitTotalTiming = AtExitTotalTimingsMeterable.calculate(meterable);
	}

	/**
	 * The total timing calculation that best fits the selection
	 */
	best(): TotalTiming {
		return this.atExitTotalTiming
			?? this.executionFlowTotalTiming
			?? this.defaultTotalTiming;
	}

	/**
	 * The total timings calculations for the status bar,
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
}
