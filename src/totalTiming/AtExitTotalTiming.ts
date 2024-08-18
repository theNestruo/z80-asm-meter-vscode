import { config } from "../config";
import { Meterable } from "../model/Meterable";
import { isCallInstruction, isConditionalInstruction, isConditionalJumpOrRetInstruction, isJumpInstruction, isRetInstruction, isUnconditionalJumpOrRetInstruction } from "../utils/AssemblyUtils";
import { TotalTimingMeterable } from "../model/TotalTimingMeterable";

/**
 * Conditionaly builds an instance of the "timing at exit" decorator
 * @param meterable The meterable instance to be decorated
 * @return The "timing at exit" decorator, or undefined
 */
export function calculateAtExitTotalTiming(meterable: Meterable): AtExitTotalTiminsMeterable | undefined {

	// (for performance reasons)
	const meterables = meterable.flatten();

	if (!canCalculateAtExitTotalTiming(meterables)) {
		return undefined;
	}

	// Builds the "timing at exit" decorator
	const lastInstruction = meterables[meterables.length - 1].instruction;
	return new AtExitTotalTiminsMeterable(meterable, lastInstruction);
}

/**
 * Checks if "timing at exit" decorator can apply to the meterable
 * @param meterables The flattened meterables of the meterable instance to be decorated
 * @return true if the "timing at exit" decorator can be applied
 */
function canCalculateAtExitTotalTiming(meterables: Meterable[]): boolean {

	const retEnabled = config.timing.atExit.retEnabled;
	const jumpEnabled = config.timing.atExit.jumpEnabled;
	const callEnabled = config.timing.atExit.callEnabled;
	const anyEnabled = retEnabled || jumpEnabled || callEnabled;
	if (!(config.statusBar.totalTimingsEnabled && anyEnabled)) {
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
	// (reverse order for performance reasons: check last instruction first)
	for (let n = meterables.length, i = n - 1; i >= 0; i--) {
		const instruction = meterables[i].instruction;
		const lastInstruction = i === n - 1;

		if (lastInstruction) {

			// Last instruction must be ret/jump/call
			if (!isValidLastInstruction(instruction, retEnabled, jumpEnabled, callEnabled)) {
				return false;
			}

			anyConditionalJump ||= isConditionalInstruction(instruction);

		} else {

			// No unconditional jump/ret before the last instruction
			if (isInvalidInstruction(instruction, stopOnUnconditionalJump)) {
				return false;
			}

			anyConditionalJump ||= isConditionalJumpOrRetInstruction(instruction);
		}
	}

	// At least one conditional jump (or call, for the last instruction)
	return anyConditionalJump
		|| !config.timing.atExit.requireConditional;
}

function isValidLastInstruction(instruction: string,
	retEnabled: boolean, jumpEnabled: boolean, callEnabled: boolean): boolean {

	return (retEnabled && isRetInstruction(instruction))
		|| (jumpEnabled && isJumpInstruction(instruction))
		|| (callEnabled && isCallInstruction(instruction));
}

function isInvalidInstruction(instruction: string, stopOnUnconditionalJump: boolean): boolean {

	return stopOnUnconditionalJump
		&& isUnconditionalJumpOrRetInstruction(instruction);
}

export class AtExitTotalTiminsMeterable extends TotalTimingMeterable {

	private readonly lastInstruction: string;
	readonly isLastInstructionRet: boolean;
	readonly isLastInstructionJump: boolean;
	readonly isLastInstructionCall: boolean;

	constructor(meterable: Meterable, lastInstruction: string) {
		super(meterable);

		this.lastInstruction = lastInstruction;
		this.isLastInstructionRet = isRetInstruction(lastInstruction);
		this.isLastInstructionJump = isJumpInstruction(lastInstruction);
		this.isLastInstructionCall = isCallInstruction(lastInstruction);
	}

	get name(): string {
		return this.lastInstruction
			? `Timing to ${this.lastInstruction}`
			: "Timing to exit point"; // (should never happen)
	}

	get statusBarIcon(): string {
		return this.isLastInstructionRet ? config.timing.atExit.retIcon
			: this.isLastInstructionJump ? config.timing.atExit.jumpIcon
				: this.isLastInstructionCall ? config.timing.atExit.callIcon
					: ""; // (should never happen)
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
