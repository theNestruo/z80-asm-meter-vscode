import { config } from "../../config";
import { Meterable, RepeatedMeterable, SourceCode } from "../../types";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware } from "../../utils/AssemblyUtils";
import { formatHexadecimalByte } from "../../utils/FormatterUtils";
import { SingletonHolderImpl as SingletonHolderImpl } from "../../utils/Lifecycle";
import { parseNumericExpression } from "../../utils/ParserUtils";
import { InstructionParser as InstructionParser } from "../Parsers";
import { z80InstructionParser } from "./Z80InstructionParser";

class AssemblyDirectiveParserHolder extends SingletonHolderImpl<AssemblyDirectiveParser> {

	protected createInstance(): AssemblyDirectiveParser {
		return new AssemblyDirectiveParser();
	}
}

export const assemblyDirectiveParser = new AssemblyDirectiveParserHolder();

//

/**
 * Actual implementation of the assembly directive parser
 */
class AssemblyDirectiveParser implements InstructionParser {

	get isEnabled(): boolean {
		return true;
	}

	parse(s: SourceCode): Meterable | undefined {

		const instruction = s.instruction;

		// Locates defb/defw/defs directives
		const mnemonic = extractMnemonicOf(instruction);
		if (["DEFB", ".DEFB", "DB", ".DB", "DEFM", ".DEFM", "DM", ".DM"].includes(mnemonic)) {
			return this.parseDefbDirective(instruction);
		}
		if (["DEFW", ".DEFW", "DW", ".DW"].includes(mnemonic)) {
			return this.parseDefwDirective(instruction);
		}
		if (["DEFS", ".DEFS", "DS", ".DS"].includes(mnemonic)) {
			return this.parseDefsDirective(instruction);
		}
		if (["RB", ".RB"].includes(mnemonic)) {
			return this.parseRbDirective(instruction);
		}
		if (["RW", ".RW"].includes(mnemonic)) {
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
			const length = operand.length;
			if ((length >= 3)
					&& "\"'".includes(operand.charAt(0))
					&& (operand.charAt(0) == operand.charAt(operand.length - 1))) {
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
				bytes.push(formatHexadecimalByte(value & 0xff)
					+ " "
					+ formatHexadecimalByte((value & 0xff00) >> 8));
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
			const instruction = z80InstructionParser.instance.parseOpcode(opcode);
			if (instruction) {
				return RepeatedMeterable.of(instruction, count);
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

	readonly isComposed = false;
}

