import { workspace } from "vscode";
import { AbstractInstruction } from "./AbstractInstruction_";
import { AssemblyDirective } from "./AssemblyDirective_";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware, formatHexadecimalByte } from "./utils";
import { Z80InstructionParser } from "./Z80InstructionParser_";

class NumericParser {

    private regex: RegExp;
    private radix: number;

    constructor(regex: RegExp, radix: number) {
        this.regex = regex;
        this.radix = radix;
    }

    public parse(s: string): number | undefined {
        const negative = s.startsWith("-");
        const us = negative ? s.substr(1) : s;
        const matches = this.regex.exec(us);
        return matches && matches.length >= 1
                ? (negative ? -1 : 1) * parseInt(matches[1], this.radix)
                : undefined;
    }
}

export class AssemblyDirectiveParser {

    // Singleton
    public static instance = new AssemblyDirectiveParser();

    // Numeric parsers
    private static numericParsers = [
        new NumericParser(/^0x([0-9a-f]+)$/i, 16),
        new NumericParser(/^[#$&]([0-9a-f]+)$/i, 16),
        new NumericParser(/^([0-9a-f]+)h$/i, 16),
        new NumericParser(/^[0@]([0-7]+)$/, 8),
        new NumericParser(/^([0-7]+)o$/i, 8),
        new NumericParser(/^%([0-1]+)$/i, 2),
        new NumericParser(/^([0-1]+)b$/i, 2),
        new NumericParser(/^(\d+)$/, 10)
    ];

    // Configuration
    private directivesAsInstructions: string | undefined = undefined;

    private constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.directivesAsInstructions = configuration.get("directivesAsInstructions", "defs");
    }

    public parse(instruction: string | undefined): AbstractInstruction[] | undefined {

        if (!instruction) {
            return undefined;
        }

        // Locates defb/defw/defs directives
        const mnemonic = extractMnemonicOf(instruction);
        if (mnemonic.match(/^(DEFB|DB)$/)) {
            return this.parseDefbDirective(instruction);
        }
        if (mnemonic.match(/^(DEFW|DW)$/)) {
            return this.parseDefwDirective(instruction);
        }
        if (mnemonic.match(/^(DEFS|DS)$/)) {
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
            if (operand.match(/^\".*\"$/)) {
                // String
                operand.substring(1, operand.length - 1).split(/""/).forEach(substring => {
                    for (var i = 0; i < substring.length; i++) {
                        bytes.push(formatHexadecimalByte(substring.charCodeAt(i)));
                    }
                });
            } else {
                // Raw values
                const value = this.parseNumericExpression(operand);
                bytes.push(value !== undefined ? formatHexadecimalByte(value) : "n");
            }
        });

        if (bytes.length === 0) {
            return undefined;
        }

        // Returns as directive
        return [new AssemblyDirective("DEFB", bytes.join(" "), bytes.length)];
    }

    private parseDefwDirective(pInstruction: string): AssemblyDirective[] | undefined {

        const operands = extractOperandsOfQuotesAware(pInstruction);
        if (operands.length < 1) {
            return undefined;
        }

        // Extracts bytes
        const bytes: string[] = [];
        operands.forEach(operand => {
            const value = this.parseNumericExpression(operand);
            if (value !== undefined) {
                bytes.push(formatHexadecimalByte(value & 0xff), formatHexadecimalByte((value & 0xff00) >> 8));
            } else {
                bytes.push("nn", "nn");
            }
        });

        if (bytes.length === 0) {
            return undefined;
        }

        // Returns as directive
        return [new AssemblyDirective("DEFW", bytes.join(" "), bytes.length)];
    }

    private parseDefsDirective(pInstruction: string): AbstractInstruction[] | undefined {

        const operands = extractOperandsOf(pInstruction);
        if ((operands.length < 1) || (operands.length > 2)) {
            return undefined;
        }

        // Extracts count and byte
        const count = this.parseNumericExpression(operands[0]);
        if ((count === undefined) || (count < 0)) {
            return undefined;
        }
        let value = operands.length === 2
                ? this.parseNumericExpression(operands[1])
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
        const byte = value !== undefined ? formatHexadecimalByte(value) : "nn";
        const bytes = new Array(count).fill(byte);
        return [new AssemblyDirective("DEFS", bytes.join(" "), count)];
    }

    private parseNumericExpression(s: string): number | undefined {

        for (let numericParser of AssemblyDirectiveParser.numericParsers) {
            const value = numericParser.parse(s);
            if ((value !== undefined) && (!isNaN(value))) {
                return value;
            }
        }

        return undefined;
    }
}
