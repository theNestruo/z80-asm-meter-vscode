import { config } from "../config";
import { Meterable } from "../types/Meterable";
import { TotalTimingMeterable } from "../types/TotalTimingMeterable";
import { AtExitTotalTimingsMeterable } from "./AtExitTotalTiming";
import { DefaultTotalTimingsMeterable } from "./DefaultTotalTiming";
import { ExecutionFlowTotalTimingsMeterable } from "./ExecutionFlowTotalTiming";

/**
 * Groups default total timings, execution flow total timings,
 * and execution flow to the selected exit point total timings
 * in a single object
 */
export class TotalTimings {

	readonly default: TotalTimingMeterable;
	readonly executionFlow?: TotalTimingMeterable;
	readonly atExit?: AtExitTotalTimingsMeterable;

	constructor(meterable: Meterable) {

		this.default = DefaultTotalTimingsMeterable.calculate(meterable);
		this.executionFlow = ExecutionFlowTotalTimingsMeterable.calculate(meterable);
		this.atExit = AtExitTotalTimingsMeterable.calculate(meterable);
	}

	best(): TotalTimingMeterable {
		return this.atExit || this.executionFlow || this.default;
	}

	ordered(): (TotalTimingMeterable | undefined)[] {

		// Applies requested order
		const [ret, jumpCall] = this.atExit?.isLastInstructionRet
			? [this.atExit, undefined]
			: [undefined, this.atExit];

		switch (config.statusBar.totalTimingsOrder) {
			case "retFlowJumpCall":
				return [this.default, ret, this.executionFlow, jumpCall];

			case "flowRetJumpCall":
				return [this.default, this.executionFlow, ret, jumpCall];

			case "retJumpCallFlow":
				return [this.default, ret, jumpCall, this.executionFlow];

			default:
				// (should never happen)
				return [this.default, undefined, undefined, undefined];
		}
	}
}
