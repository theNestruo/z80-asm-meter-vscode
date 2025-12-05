/**
 * A container for source code:
 * an instruction, and an optional trailing comment of the entire line
 */
export class SourceCode {

	readonly repetitions: number;

	/**
	 * Constructor
	 * @param instruction The instruction (the actual source code)
	 * @param label The optional label
	 * @param afterLabelPosition The position where the optional label ends
	 * @param repetitions The optional line repetition count
	 * @param beforeLineCommentPosition The position where the optional trailing comment of the entire line starts
	 * @param afterLineCommentPosition The position where the optional trailing comment of the entire line starts
	 * @param lineComment The optional trailing comment of the entire line
	 */
	constructor(
		readonly instruction: string,
		readonly label?: string,
		readonly afterLabelPosition?: number,
		repetitions?: number,
		readonly beforeLineCommentPosition?: number,
		readonly afterLineCommentPosition?: number,
		readonly lineComment?: string) {

		this.repetitions = repetitions ?? 1;
	}
}
