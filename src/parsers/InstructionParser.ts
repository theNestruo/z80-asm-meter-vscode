import { Meterable } from "../types/Meterable";
import { SourceCode } from "../types/SourceCode";


export interface InstructionParser {

	parse(s: SourceCode): Meterable | undefined;
}
