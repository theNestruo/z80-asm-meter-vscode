import type { Meterable } from "../../../types/Meterable";
import type { SourceCode } from "../../../types/SourceCode";

/**
 * An instruction parser
 */
export interface InstructionParser {

	/**
	 * @param sourceCode the source code to be parsed
	 * @returns a Meterable parsed from the source code,
	 * or undefined if the source code contained no valid instructions
	 */
	parseInstruction(sourceCode: SourceCode): Meterable | undefined;
}
