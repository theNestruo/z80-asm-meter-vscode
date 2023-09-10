import Meterable from "../../model/Meterable";
import { isConditionalJump, isConditionalJumpOrCall, isUnconditionalJump } from "../../utils/AssemblyUtils";
import { flatten } from "../../utils/MeterableUtils";
import TimingDecorator from "./TimingDecorator";

export default class FlowDecorator extends TimingDecorator {

	/**
	 * Checks if "execution flow timings" decorator can apply to the meterable
	 * @param meterable The meterable instance to be decorated
	 * @return The "execution flow timings" decorator, or the original meterable
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

			// No unconditional jumps
			if (isUnconditionalJump(instruction)) {
				return false;
			}

			const lastInstruction = i === n-1;
			anyConditionalJump ||= isConditionalJumpOrCall(instruction, lastInstruction);
		}

		// At least one conditional jump (or call, for the last instruction)
		return anyConditionalJump;
	}

	/**
	 * Conditionaly builds an instance of the "execution flow timings" decorator
	 * @param meterable The meterable instance to be decorated
	 * @return The "execution flow timings" decorator, or the original meterable
	 */
	static of(meterable: Meterable): Meterable {

		// Builds the "execution flow timings" decorator
		return this.canDecorate(meterable)
			? new FlowDecorator(meterable)
			: meterable;
	}

	private constructor(meterable: Meterable) {
		super(meterable);
	}

	getDescription(): string {
		return "Flow";
	}

	getIcon(): string {
		return "$(debug-step-over)";
	}

	protected modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[] {

		return isConditionalJump(instruction)
			? [timing[1], timing[1]]	// "Not taken" timings
			: timing;
	}
}
