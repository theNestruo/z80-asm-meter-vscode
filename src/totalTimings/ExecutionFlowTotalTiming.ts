import { config } from "../config";
import { Meterable } from "../types/Meterable";
import { TotalTimingMeterable } from "../types/TotalTimingMeterable";
import { isConditionalInstruction, isConditionalJumpOrRetInstruction, isUnconditionalJumpOrRetInstruction } from "../utils/AssemblyUtils";

export class ExecutionFlowTotalTimingsMeterable extends TotalTimingMeterable {

	/**
	 * Conditionaly builds an instance of the "execution flow timing" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "execution flow timing" decorator, or undefined
	 */
	public static calculate(meterable: Meterable): TotalTimingMeterable | undefined {

		// Builds the "execution flow timing" decorator
		return this.canCalculate(meterable)
			? new ExecutionFlowTotalTimingsMeterable(meterable)
			: undefined;
	}

	/**
	 * Checks if "execution flow timing" decorator can apply to the meterable
	 * @param meterable The meterable instance to be decorated
	 * @return true if the "execution flow timing" decorator can be applied
	 */
	private static canCalculate(meterable: Meterable): boolean {

		if (!config.statusBar.totalTimingsEnabled
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
			const lastInstruction = i === n - 1;

			// No unconditional jumps
			if (isStopOnUnconditionalJump
				&& isUnconditionalJumpOrRetInstruction(instruction)) {
				return false;
			}

			anyConditionalJump ||= lastInstruction
				? isConditionalInstruction(instruction)
				: isConditionalJumpOrRetInstruction(instruction);
		}

		// At least one conditional jump/ret
		return anyConditionalJump
			|| !config.timing.executionFlow.requireConditional;
	}

	private constructor(meterable: Meterable) {
		super(meterable);
	}

	name = "Execution flow timing";

	get statusBarIcon(): string {
		return config.timing.executionFlow.icon;
	}

	protected modifiedTimingsOf(timing: number[],
		_i: number, _n: number, instruction: string): number[] {

		return isConditionalJumpOrRetInstruction(instruction)
			? [timing[1], timing[1]]	// "Not taken" timing
			: timing;
	}
}
