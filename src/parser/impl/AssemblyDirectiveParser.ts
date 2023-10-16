import { workspace } from "vscode";
import { Meterable } from "../../model/Meterable";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware } from "../../utils/AssemblyUtils";
import { NumericExpressionParser } from "../../utils/NumberUtils";
import { InstructionParser } from "../Parsers";
import { Z80InstructionParser } from "./Z80InstructionParser";
import { SourceCode } from "../../model/SourceCode";
import { RepeatedMeterable } from "../../model/RepeatedMeterable";
import { formatHexadecimalByte } from "../../utils/ByteUtils";
import { config } from "../../config";

export class AssemblyDirectiveParser implements InstructionParser {

    // Singleton
    static readonly instance = new AssemblyDirectiveParser();

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
                var string = operand.substring(1, operand.length - 1);
                for (let i = 0; i < string.length; i++) {
                    bytes.push(formatHexadecimalByte(string.charCodeAt(i)));
                }
            } else {
                // Raw values
                const value = NumericExpressionParser.parse(operand);
                bytes.push(value !== undefined ? formatHexadecimalByte(value) : "n");
            }
        });

        if (bytes.length === 0) {
            return undefined;
        }

        // Returns as directive
        return new AssemblyDirective("DEFB", bytes, bytes.length);
    }

    private parseDefwDirective(pInstruction: string): AssemblyDirective | undefined {

        const operands = extractOperandsOfQuotesAware(pInstruction);
        if (operands.length < 1) {
            return undefined;
        }

        // Extracts bytes
        const bytes: string[] = [];
        operands.forEach(operand => {
            const value = NumericExpressionParser.parse(operand);
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
        const count = NumericExpressionParser.parse(operands[0]);
        if ((count === undefined) || (count < 0)) {
            return undefined;
        }
        const value = operands.length === 2
            ? NumericExpressionParser.parse(operands[1])
            : undefined;

        // Determines instruction
        if (config.parser.directivesDefsAsInstructions) {
            const opcode = value !== undefined
                ? value
                : 0x00; // (defaults to NOP)
            const instruction = Z80InstructionParser.instance.parseOpcode(opcode);
            if (instruction) {
                return RepeatedMeterable.of(instruction, count);
            }
        }

        // Returns as directive
        const byte = value !== undefined ? formatHexadecimalByte(value) : "n";
        const bytes = new Array(count).fill(byte);
        return new AssemblyDirective("DEFS", bytes, count);
    }
}

/**
 * An assembly directive, such as `db`, `dw` or `ds`
 */
export class AssemblyDirective implements Meterable {

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
