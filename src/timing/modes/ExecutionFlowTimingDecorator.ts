import { workspace } from "vscode";
import Meterable from "../../model/Meterable";
import { isConditionalInstruction, isConditionalJumpOrRetInstruction, isUnconditionalJumpOrRetInstruction } from "../../utils/AssemblyUtils";
import { flatten } from "../../utils/MeterableUtils";
import TimingDecorator from "./TimingDecorator";

export default class FlowDecorator extends TimingDecorator {

	/**
	 * Checks if "execution flow timings" decorator can apply to the meterable
	 * @param meterable The meterable instance to be decorated
	 * @return The "execution flow timings" decorator, or the original meterable
	 */
	static canDecorate(meterable: Meterable): boolean {

		// Reads relevant configuration
		const threshold = workspace.getConfiguration("z80-asm-meter").get("timings.threshold", 2);

		// Length check
		const meterables: Meterable[] = flatten(meterable);
		if ((threshold > 0) && (meterables.length < threshold)) {
			return false;
		}

		// Checks the instructions
		let anyConditionalJump: boolean = false;
		for (let i = 0, n = meterables.length; i < n; i++) {
			const instruction = meterables[i].getInstruction();

			// No unconditional jumps
			if (isUnconditionalJumpOrRetInstruction(instruction)) {
				return false;
			}

			const lastInstruction = i === n - 1;
			anyConditionalJump ||= lastInstruction
				? isConditionalInstruction(instruction)
				: isConditionalJumpOrRetInstruction(instruction);
		}

		// At least one conditional jump/ret (or call, for the last instruction)
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
		return "Execution flow";
	}

	getIcon(): string {
		return "$(debug-step-over)";
	}

	protected modifiedTimingsOf(timing: number[],
		i: number, n: number, instruction: string): number[] {

		return isConditionalJumpOrRetInstruction(instruction)
			? [timing[1], timing[1]]	// "Not taken" timings
			: timing;
	}
}
