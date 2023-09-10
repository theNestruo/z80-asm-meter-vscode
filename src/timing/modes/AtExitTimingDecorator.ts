import Meterable from "../../model/Meterable";
import { isConditionalInstruction, isConditionalJumpOrRetInstruction, isJumpCallOrRetInstruction, isJumpOrCallInstruction, isUnconditionalJumpOrRetInstruction } from "../../utils/AssemblyUtils";
import { flatten } from "../../utils/MeterableUtils";
import TimingDecorator from "./TimingDecorator";

export default class AtExitDecorator extends TimingDecorator {

	/**
	 * Checks if "timings at exit" decorator can apply to the meterable
	 * @param meterable The meterable instance to be decorated
	 * @return The "timings at exit" decorator, or the original meterable
	 */
	static canDecorate(meterable: Meterable): boolean {

		// Length check
		const meterables: Meterable[] = flatten(meterable);
		if (meterables.length < 2) {
			return false;
		}

		// Checks the instructions
		let anyConditionalJump: boolean = false;
		for (let i = 0, n = meterables.length; i < n; i++) {
			const instruction = meterables[i].getInstruction();

			// No unconditional jump/ret before the last instruction
			if ((i < n - 1) && isUnconditionalJumpOrRetInstruction(instruction)) {
				return false;
			}

			// Last instruction must be jump/ret or call
			const lastInstruction = i === n - 1;
			if (lastInstruction && (!isJumpCallOrRetInstruction(instruction))) {
				return false;
			}

			anyConditionalJump ||= lastInstruction
				? isConditionalInstruction(instruction)
				: isConditionalJumpOrRetInstruction(instruction);
		}

		// At least one conditional jump (or call, for the last instruction)
		return anyConditionalJump;
	}

	/**
	 * Conditionaly builds an instance of the "timings at exit" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "timings at exit" decorator, or the original meterable
	 */
	static of(meterable: Meterable): Meterable {

		// Builds the "timings at exit" decorator
		return this.canDecorate(meterable)
			? new AtExitDecorator(meterable)
			: meterable;
	}

	private isLastInstructionJumpOrCall: boolean;

	private constructor(meterable: Meterable) {
		super(meterable);

		const meterables: Meterable[] = flatten(meterable);
		this.isLastInstructionJumpOrCall = isJumpOrCallInstruction(meterables[meterables.length - 1].getInstruction());
	}

	getDescription(): string {
		return "At exit point";
	}

	getIcon(): string {
		return this.isLastInstructionJumpOrCall ? "$(debug-step-out)" : "$(debug-step-into)";
	}

	protected modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[] {

		// Last instruction?
		if (i === n - 1) {
			return isConditionalInstruction(instruction)
				? [timing[0], timing[0]]	// "Taken" timings
				: timing;
		}

		// Previous instruction
		return isConditionalJumpOrRetInstruction(instruction)
			? [timing[1], timing[1]]	// "Not taken" timings
			: timing;
	}
}
