import type { Meterable } from "../../../types/Meterable";
import type { Z80Instruction } from "../impl/Z80InstructionParser";
import type { InstructionParser } from "./InstructionParser";

/**
 * A Z80 instruction parser.
 * Provides additional parse entry points for fake instruction parsers
 */
export interface Z80InstructionParser extends InstructionParser {

	parseRawInstruction(instruction: string): Meterable | undefined;

	parseOpcode(opcode: number): Z80Instruction | undefined;
}
