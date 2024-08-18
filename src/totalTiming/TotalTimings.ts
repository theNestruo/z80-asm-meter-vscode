import { config } from "../config";
import { Meterable } from "../model/Meterable";
import { TotalTimingMeterable } from "../model/TotalTimingMeterable";
import { AtExitTotalTiminsMeterable, calculateAtExitTotalTiming } from "./AtExitTotalTiming";
import { calculateDefaultTotalTiming } from "./DefaultTotalTiming";
import { calculateExecutionFlowTotalTiming } from "./ExecutionFlowTotalTiming";

export class TotalTimings {

	readonly defaultTiming: TotalTimingMeterable;

	readonly flowTiming: TotalTimingMeterable | undefined;

	readonly atExitTiming: AtExitTotalTiminsMeterable | undefined;

	constructor(meterable: Meterable) {

		this.defaultTiming = calculateDefaultTotalTiming(meterable);
		this.flowTiming = calculateExecutionFlowTotalTiming(meterable);
		this.atExitTiming = calculateAtExitTotalTiming(meterable);
	}

	best(): TotalTimingMeterable {
		return this.atExitTiming || this.flowTiming || this.defaultTiming;
	}

	ordered(): (TotalTimingMeterable | undefined)[] {

		// Applies requested order
		const [retTiming, jumpCallTiming] = this.atExitTiming?.isLastInstructionRet
			? [this.atExitTiming, undefined]
			: [undefined, this.atExitTiming];

		switch (config.statusBar.totalTimingsOrder) {
			case "retFlowJumpCall":
				return [this.defaultTiming, retTiming, this.flowTiming, jumpCallTiming];

			case "flowRetJumpCall":
				return [this.defaultTiming, this.flowTiming, retTiming, jumpCallTiming];

			case "retJumpCallFlow":
				return [this.defaultTiming, retTiming, jumpCallTiming, this.flowTiming];

			default:
				// (should never happen)
				return [this.defaultTiming, undefined, undefined, undefined];
		}
	}
}
