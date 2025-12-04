import { Meterable } from "../../../types/Meterable";
import { SourceCode } from "../../../types/SourceCode";

/**
 * An instruction parser
 */
export interface InstructionParser {

	parseInstruction(s: SourceCode): Meterable | undefined;
}
