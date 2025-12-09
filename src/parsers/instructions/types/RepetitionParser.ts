/**
 * A repetition parser
 */
export interface RepetitionParser {

	/**
	 * @param instruction the instruction part of the source code to be parsed
	 * @returns a repetition count if the instruction begins a repeat block,
	 * or undefined if the instruction does not begin a repeat block
	 */
	parseBeginRepetition(instruction: string): number | undefined;

	/**
	 * @param instruction the instruction part of the source code to be parsed
	 * @returns true if the instruction end a repeat block, false otherwise
	 */
	parseEndRepetition(instruction: string): boolean;
}
