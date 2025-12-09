import type { Meterable } from "../../../types/Meterable";
import type { Z80Instruction } from "../impl/Z80InstructionParser";
import type { InstructionParser } from "./InstructionParser";

/**
 * A Z80 instruction parser.
 * Provides additional parse entry points for fake instruction parsers
 */
export interface Z80InstructionParser extends InstructionParser {

	/**
	 * @param instruction the instruction part of the source code to be parsed
	 * @returns a Meterable parsed from the instruction part of the source code,
	 * or undefined if the instruction part of the source code contained no valid instructions
	 */
	parseRawInstruction(instruction: string): Meterable | undefined;

	/**
	 * @param opcode a single byte opcode
	 * @returns the Z80 instruction definition that matches the provided opcode,
	 * or undefined if no Z80 instruction matches the provided opcode
	 */
	parseOpcode(opcode: number): Z80Instruction | undefined;
}
