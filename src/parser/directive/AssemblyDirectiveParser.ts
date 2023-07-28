import { workspace } from "vscode";
import { AssemblyDirective } from "./model/AssemblyDirective";
import { Meterable } from "../../model/Meterable";
import { NumericExpressionParser } from "../NumericExpressionParser";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware, formatHexadecimalByte } from "../../utils";
import { Z80InstructionParser } from "../z80/Z80InstructionParser";

export class AssemblyDirectiveParser {

    // Singleton
    public static instance = new AssemblyDirectiveParser();

    // Configuration
    private directivesAsInstructions: string;

    private constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.directivesAsInstructions = configuration.get("directivesAsInstructions", "defs");
    }

    public parse(instruction: string | undefined): Meterable[] | undefined {

        if (!instruction) {
            return undefined;
        }

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

    private parseDefbDirective(pInstruction: string): AssemblyDirective[] | undefined {

        const operands = extractOperandsOfQuotesAware(pInstruction);
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
        return [new AssemblyDirective("DEFB", bytes, bytes.length)];
    }

    private parseDefwDirective(pInstruction: string): AssemblyDirective[] | undefined {

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
        return [new AssemblyDirective("DEFW", bytes, bytes.length * 2)];
    }

    private parseDefsDirective(pInstruction: string): Meterable[] | undefined {

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
        if (this.directivesAsInstructions === "defs") {
            const opcode = value !== undefined ? value : 0x00; // (defaults to NOP)
            const instruction = Z80InstructionParser.instance.parseOpcode(opcode);
            if (instruction) {
                return new Array(count).fill(instruction);
            }
        }

        // Returns as directive
        const byte = value !== undefined ? formatHexadecimalByte(value) : "n";
        const bytes = new Array(count).fill(byte);
        return [new AssemblyDirective("DEFS", bytes, count)];
    }
}
