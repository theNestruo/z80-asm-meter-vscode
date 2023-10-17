import { config } from "../config";
import { Meterable } from "../model/Meterable";
import { isConditionalInstruction, isConditionalJumpOrRetInstruction, isJumpCallOrRetInstruction, isJumpOrCallInstruction, isUnconditionalJumpOrRetInstruction } from "../utils/AssemblyUtils";
import { TotalTiming, TotalTimingMeterable } from "./TotalTiming";

class AtExitTotalTimingsMeterable extends TotalTimingMeterable {

	private isLastInstructionJumpOrCall: boolean;

	constructor(meterable: Meterable, isLastInstructionJumpOrCall: boolean) {
		super(meterable);

		this.isLastInstructionJumpOrCall = isLastInstructionJumpOrCall;
	}

	get name(): string {
		return "Timing to exit point";
	}

	get statusBarIcon(): string {
		return this.isLastInstructionJumpOrCall ? "$(debug-step-out)" : "$(debug-step-into)";
	}

	protected modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[] {

		// Last instruction?
		if (i === n - 1) {
			return isConditionalInstruction(instruction)
				? [timing[0], timing[0]]	// "Taken" timing
				: timing;
		}

		// Previous instruction
		return isConditionalJumpOrRetInstruction(instruction)
			? [timing[1], timing[1]]	// "Not taken" timing
			: timing;
	}
}

class AtExitTotalTiming implements TotalTiming {

	/**
	 * Conditionaly builds an instance of the "timing at exit" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "timing at exit" decorator, or undefined
	 */
	applyTo(meterable: Meterable): TotalTimingMeterable | undefined {

		// (for performance reasons)
		const meterables = meterable.flatten();

		if (!this.canDecorate(meterables)) {
			return undefined;
		}

		// Builds the "timing at exit" decorator
		const isLastInstructionJumpOrCall = isJumpOrCallInstruction(meterables[meterables.length - 1].instruction);
		return new AtExitTotalTimingsMeterable(meterable, isLastInstructionJumpOrCall);
	}

	/**
	 * Checks if "timing at exit" decorator can apply to the meterable
	 * @param meterables The flattened meterables of the meterable instance to be decorated
	 * @return true if the "timing at exit" decorator can be applied
	 */
	private canDecorate(meterables: Meterable[]): boolean {

		if (!config.statusBar.totalTimings
			|| !config.timing.atExit.enabled) {
			return false;
		}

		// Length check
		const threshold = config.timing.atExit.threshold;
		if ((threshold > 0) && (meterables.length < threshold)) {
			return false;
		}

		const stopOnUnconditionalJump = config.timing.atExit.stopOnUnconditionalJump;

		// Checks the instructions
		let anyConditionalJump: boolean = false;
		for (let i = 0, n = meterables.length; i < n; i++) {
			const instruction = meterables[i].instruction;
			const lastInstruction = i === n - 1;

			// No unconditional jump/ret before the last instruction
			if (stopOnUnconditionalJump
				&& !lastInstruction
				&& isUnconditionalJumpOrRetInstruction(instruction)) {
				return false;
			}

			// Last instruction must be jump/ret or call
			if (lastInstruction && (!isJumpCallOrRetInstruction(instruction))) {
				return false;
			}

			anyConditionalJump ||= lastInstruction
				? isConditionalInstruction(instruction)
				: isConditionalJumpOrRetInstruction(instruction);
		}

		// At least one conditional jump (or call, for the last instruction)
		return anyConditionalJump
			|| !config.timing.atExit.requireConditional;
	}
}

export const atExitTotalTiming = new AtExitTotalTiming();

