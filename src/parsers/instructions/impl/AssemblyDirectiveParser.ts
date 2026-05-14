import { config } from "../../../config";
import { RepeatedMeterable } from "../../../types/AggregatedMeterables";
import type { Meterable } from "../../../types/Meterable";
import { SingletonRefImpl, type SingletonRef } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware } from "../../../utils/AssemblyUtils";
import { formatHexadecimalByte, parseNumericExpression } from "../../../utils/NumberUtils";
import type { InstructionParser } from "../types/InstructionParser";
import { z80InstructionParser } from "./Z80InstructionParser";

class AssemblyDirectiveParserRef extends SingletonRefImpl<InstructionParser, AssemblyDirectiveParser> {

	protected createInstance(): AssemblyDirectiveParser {
		return new AssemblyDirectiveParser();
	}
}

export const assemblyDirectiveParser: SingletonRef<InstructionParser> = new AssemblyDirectiveParserRef();

//

/**
 * Actual implementation of the assembly directive parser
 */
class AssemblyDirectiveParser implements InstructionParser {

	parseInstruction(s: SourceCode): Meterable | undefined {

		const instruction = s.instruction;

		// Locates defb/defw/defs directives
		switch (extractMnemonicOf(instruction)) {
			case "DEFB": case ".DEFB":
			case "DB": case ".DB":
			case "DEFM": case ".DEFM":
			case "DM": case ".DM":
				return this.parseDefbDirective(instruction);

			case "DEFW": case ".DEFW":
			case "DW": case ".DW":
				return this.parseDefwDirective(instruction);

			case "DEFS": case ".DEFS":
			case "DS": case ".DS":
				return this.parseDefsDirective(instruction);

			case "RB": case ".RB":
				return this.parseRbDirective(instruction);

			case "RW": case ".RW":
				return this.parseRwDirective(instruction);

			default:
				// (unknown mnemonic/directive)
				return undefined;
		}
	}

	private parseDefbDirective(instruction: string): AssemblyDirective | undefined {

		const operands = extractOperandsOfQuotesAware(instruction);
		if (operands.length < 1) {
			return undefined;
		}

		// Extracts bytes
		const bytes: string[] = [];
		for (const operand of operands) {
			const length = operand.length;
			if ((length >= 3)
				&& "\"'".includes(operand[0])
				&& operand.endsWith(operand[0])) {
				// String
				const string = operand.substring(1, operand.length - 1);
				for (let i = 0, n = string.length; i < n; i++) {
					bytes.push(formatHexadecimalByte(string.charCodeAt(i)));
				}
			} else {
				// Raw values
				const value = parseNumericExpression(operand);
				bytes.push(value !== undefined ? formatHexadecimalByte(value) : "n");
			}
		};

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
		for (const operand of operands) {
			const value = parseNumericExpression(operand);
			if (value !== undefined) {
				const lowByte = formatHexadecimalByte(value & 0xff);
				const highByte = formatHexadecimalByte((value & 0xff00) >> 8);
				bytes.push(`${lowByte} ${highByte}`);
			} else {
				bytes.push("n n");
			}
		}

		if (bytes.length === 0) {
			return undefined;
		}

		// Returns as directive
		return new AssemblyDirective("DEFW", bytes, bytes.length * 2);
	}

	private parseDefsDirective(instruction: string): Meterable | undefined {

		const operands = extractOperandsOf(instruction);
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
			const opcode = value ?? 0x00; // (defaults to NOP)
			const instruction = z80InstructionParser.instance.parseOpcode(opcode);
			if (instruction) {
				return RepeatedMeterable.of(instruction, count);
			}
		}

		// Returns as directive
		const byte = value !== undefined ? formatHexadecimalByte(value) : "n";
		const bytes = this.nCopies(byte, count);
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
		const bytes = this.nCopies("n", count);
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
		const words = this.nCopies("nn", count);
		return new AssemblyDirective("RW", words, count * 2);
	}

	private nCopies(value: string, count: number): string[] {
		return Array.from<string>({ length: count }).fill(value);
	}
}

/**
 * An assembly directive, such as `db`, `dw` or `ds`
 */
class AssemblyDirective implements Meterable {

	readonly z80Timing = [0, 0];
	readonly msxTiming = [0, 0];
	readonly cpcTiming = [0, 0];

	constructor(
		private readonly directive: string,
		readonly bytes: string[],
		readonly size: number) {
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
