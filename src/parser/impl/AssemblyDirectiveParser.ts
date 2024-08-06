import { config } from "../../config";
import { Meterable } from "../../model/Meterable";
import { repeatedMeterable } from "../../model/RepeatedMeterable";
import { SourceCode } from "../../model/SourceCode";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware } from "../../utils/AssemblyUtils";
import { formatHexadecimalByte } from "../../utils/ByteUtils";
import { parseNumericExpression } from "../../utils/NumberUtils";
import { InstructionParser } from "../Parsers";
import { z80InstructionParser } from "./Z80InstructionParser";

/**
 * An assembly directive, such as `db`, `dw` or `ds`
 */
class AssemblyDirective implements Meterable {

	// Information
	private readonly directive: string;
	readonly z80Timing = [0, 0];
	readonly msxTiming = [0, 0];
	readonly cpcTiming = [0, 0];
	readonly bytes: string[];
	readonly size: number;

	constructor(
		directive: string, bytes: string[], size: number) {

		this.directive = directive;
		this.bytes = bytes;
		this.size = size;
	}

	/**
	 * @returns The directive
	 */
	get instruction(): string {
		return this.directive;
	}

	flatten(): Meterable[] {
		return [this];
	}

	readonly composed = false;
}

class AssemblyDirectiveParser implements InstructionParser {

	get isEnabled(): boolean {
		return true;
	}

	parse(s: SourceCode): Meterable | undefined {

		const instruction = s.instruction;

		// Locates defb/defw/defs directives
		const mnemonic = extractMnemonicOf(instruction);
		if (mnemonic.match(/^[.]?(DEFB|DB|DEFM|DM)$/)) {
			return this.parseDefbDirective(instruction);
		}
		if (mnemonic.match(/^[.]?(DEFW|DW)$/)) {
			return this.parseDefwDirective(instruction);
		}
		if (mnemonic.match(/^[.]?(DEFS|DS)$/)) {
			return this.parseDefsDirective(instruction);
		}
		if (mnemonic.match(/^[.]?(RB)$/)) {
			return this.parseRbDirective(instruction);
		}
		if (mnemonic.match(/^[.]?(RW)$/)) {
			return this.parseRwDirective(instruction);
		}

		// (unknown mnemonic/directive)
		return undefined;
	}

	private parseDefbDirective(instruction: string): AssemblyDirective | undefined {

		const operands = extractOperandsOfQuotesAware(instruction);
		if (operands.length < 1) {
			return undefined;
		}

		// Extracts bytes
		const bytes: string[] = [];
		operands.forEach(operand => {
			if (operand.match(/^((".*")|('.*'))$/)) {
				// String
				const string = operand.substring(1, operand.length - 1);
				for (let i = 0; i < string.length; i++) {
					bytes.push(formatHexadecimalByte(string.charCodeAt(i)));
				}
			} else {
				// Raw values
				const value = parseNumericExpression(operand);
				bytes.push(value !== undefined ? formatHexadecimalByte(value) : "n");
			}
		});

		if (bytes.length === 0) {
			return undefined;
		}

		// Returns as directive
		return new AssemblyDirective("DEFB", bytes, bytes.length);
	}

	private parseDefwDirective(instruction: string): AssemblyDirective | undefined {

		const operands = extractOperandsOfQuotesAware(instruction);
		if (operands.length < 1) {
			return undefined;
		}

		// Extracts bytes
		const bytes: string[] = [];
		operands.forEach(operand => {
			const value = parseNumericExpression(operand);
			if (value !== undefined) {
				bytes.push(formatHexadecimalByte(value & 0xff) + " " + formatHexadecimalByte((value & 0xff00) >> 8));
			} else {
				bytes.push("n n");
			}
		});

		if (bytes.length === 0) {
			return undefined;
		}

		// Returns as directive
		return new AssemblyDirective("DEFW", bytes, bytes.length * 2);
	}

	private parseDefsDirective(pInstruction: string): Meterable | undefined {

		const operands = extractOperandsOf(pInstruction);
		if ((operands.length < 1) || (operands.length > 2)) {
			return undefined;
		}

		// Extracts count and byte
		const count = parseNumericExpression(operands[0]);
		if ((count === undefined) || (count < 0)) {
			return undefined;
		}
		const value = operands.length === 2
			? parseNumericExpression(operands[1])
			: undefined;

		// Determines instruction
		if (config.parser.directivesDefsAsInstructions) {
			const opcode = value !== undefined
				? value
				: 0x00; // (defaults to NOP)
			const instruction = z80InstructionParser.parseOpcode(opcode);
			if (instruction) {
				return repeatedMeterable(instruction, count);
			}
		}

		// Returns as directive
		const byte = value !== undefined ? formatHexadecimalByte(value) : "n";
		const bytes = new Array(count).fill(byte);
		return new AssemblyDirective("DEFS", bytes, count);
	}

	private parseRbDirective(instruction: string): AssemblyDirective | undefined {

		const operands = extractOperandsOfQuotesAware(instruction);
		if (operands.length !== 1) {
			return undefined;
		}

		// Extracts count
		const count = parseNumericExpression(operands[0]);
		if ((count === undefined) || (count < 0)) {
			return undefined;
		}

		// Returns as directive
		const bytes = new Array(count).fill("n");
		return new AssemblyDirective("RB", bytes, count);
	}

	private parseRwDirective(instruction: string): AssemblyDirective | undefined {

		const operands = extractOperandsOfQuotesAware(instruction);
		if (operands.length !== 1) {
			return undefined;
		}

		// Extracts count
		const count = parseNumericExpression(operands[0]);
		if ((count === undefined) || (count < 0)) {
			return undefined;
		}

		// Returns as directive
		const words = new Array(count).fill("nn");
		return new AssemblyDirective("RW", words, count * 2);
	}
}

export const assemblyDirectiveParser = new AssemblyDirectiveParser();

