import type { Meterable } from "../../../types/Meterable";
import type { SourceCode } from "../../../types/SourceCode";

/**
 * An instruction parser
 */
export interface InstructionParser {

	parseInstruction(s: SourceCode): Meterable | undefined;
}
