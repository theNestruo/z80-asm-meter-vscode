import { config } from "../config";
import { Meterable } from "../model/Meterables";
import { TotalTimingMeterable } from "../model/TotalTimingMeterable";
import { AtExitTotalTimingsMeterable, calculateAtExitTotalTiming } from "./AtExitTotalTiming";
import { calculateDefaultTotalTiming } from "./DefaultTotalTiming";
import { calculateExecutionFlowTotalTiming } from "./ExecutionFlowTotalTiming";

export class TotalTimings {

	readonly default: TotalTimingMeterable;

	readonly executionFlow: TotalTimingMeterable | undefined;

	readonly atExit: AtExitTotalTimingsMeterable | undefined;

	constructor(meterable: Meterable) {

		this.default = calculateDefaultTotalTiming(meterable);
		this.executionFlow = calculateExecutionFlowTotalTiming(meterable);
		this.atExit = calculateAtExitTotalTiming(meterable);
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
