import { config } from "../config";
import { Meterable } from "../model/Meterable";
import { isConditionalInstruction, isConditionalJumpOrRetInstruction, isUnconditionalJumpOrRetInstruction } from "../utils/AssemblyUtils";
import { TotalTiming, TotalTimingMeterable } from "./TotalTiming";

export class ExecutionFlowTotalTiming implements TotalTiming {

    // Singleton
    static instance = new ExecutionFlowTotalTiming();

	private constructor() {}

	/**
	 * Conditionaly builds an instance of the "execution flow timing" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "execution flow timing" decorator, or undefined
	 */
	applyTo(meterable: Meterable): TotalTimingMeterable | undefined {

		// Builds the "execution flow timing" decorator
		return this.canDecorate(meterable)
			? new ExecutionFlowTotalTimingsMeterable(meterable)
			: undefined;
	}

	/**
	 * Checks if "execution flow timing" decorator can apply to the meterable
	 * @param meterable The meterable instance to be decorated
	 * @return true if the "execution flow timing" decorator can be applied
	 */
	private canDecorate(meterable: Meterable): boolean {

		if (!config.statusBar.totalTimings
			|| !config.timing.executionFlow.enabled) {
			return false;
		}

		// Length check
		const meterables = meterable.flatten();
		const threshold = config.timing.executionFlow.threshold;
		if ((threshold > 0) && (meterables.length < threshold)) {
			return false;
		}

		const isStopOnUnconditionalJump = config.timing.executionFlow.stopOnUnconditionalJump;

		// Checks the instructions
		let anyConditionalJump: boolean = false;
		for (let i = 0, n = meterables.length; i < n; i++) {
			const instruction = meterables[i].instruction;

			// No unconditional jumps
			if (isStopOnUnconditionalJump
				&& isUnconditionalJumpOrRetInstruction(instruction)) {
				return false;
			}

			const lastInstruction = i === n - 1;
			anyConditionalJump ||= lastInstruction
				? isConditionalInstruction(instruction)
				: isConditionalJumpOrRetInstruction(instruction);
		}

		// At least one conditional jump/ret
		return anyConditionalJump
			|| !config.timing.executionFlow.requireConditional;
	}
}

class ExecutionFlowTotalTimingsMeterable extends TotalTimingMeterable {

	constructor(meterable: Meterable) {
		super(meterable);
	}

	get name(): string {
		return "Execution flow";
	}

	get description(): string {
		return "Execution flow";
	}

	get statusBarIcon(): string {
		return "$(debug-step-over)";
	}

	protected modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[] {

		return isConditionalJumpOrRetInstruction(instruction)
			? [timing[1], timing[1]]	// "Not taken" timing
			: timing;
	}
}
