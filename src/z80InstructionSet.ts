import { workspace } from "vscode";
import { NumericParser } from "./numericParser";
import { Z80AbstractInstruction } from "./z80AbstractInstruction";
import { Z80Directive } from "./z80Directive";
import { Z80Instruction } from "./z80Instruction";
import { z80InstructionSetRawData } from "./z80InstructionSetRawData";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware, formatHexadecimalByte } from "./z80Utils";

export class Z80InstructionSet {

    // Singleton
    public static instance = new Z80InstructionSet();

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

    // Instruction maps
    private instructionByMnemonic: Record<string, Z80Instruction[]>;
    private instructionByOpcode: Record<string, Z80Instruction>;

    private constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.directivesAsInstructions = configuration.get("directivesAsInstructions", "defs");

        // Initializes instruction maps
        this.instructionByMnemonic = {};
        this.instructionByOpcode = {};
        z80InstructionSetRawData.forEach(rawData => {

            // Parses the raw instruction
            const originalInstruction = new Z80Instruction(
                    rawData[0], // instructionSet
                    rawData[1], // raw instruction
                    rawData[2], // z80Timing
                    rawData[3], // msxTiming
                    rawData[4], // cpcTiming
                    rawData[5], // opcode
                    rawData[6]); // size

            originalInstruction.expand().forEach(instruction => {
                // Prepares a map by mnemonic for performance reasons
                const mnemonic = instruction.getMnemonic();
                if (!this.instructionByMnemonic[mnemonic]) {
                    this.instructionByMnemonic[mnemonic] = [];
                }
                this.instructionByMnemonic[mnemonic].push(instruction);

                // Prepares a map by opcode for single byte instructions
                const opcode = instruction.getOpcode();
                this.instructionByOpcode[opcode] = instruction;
            });
        });
    }

    public parseInstructions(instruction: string | undefined, instructionSets: string[]): Z80AbstractInstruction[] | undefined {

        if (!instruction) {
            return undefined;
        }

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            const parsedInstruction = this.findBestCandidate(instruction, candidates, instructionSets);
            return parsedInstruction ? [parsedInstruction] : undefined;
        }

        // Locates defb/defw/defs directives
        if (mnemonic.match(/^(DEFB|DB)$/)) {
            return this.parseDefbDirective(instruction);
        } else if (mnemonic.match(/^(DEFW|DW)$/)) {
            return this.parseDefwDirective(instruction);
        } else if (mnemonic.match(/^(DEFS|DS)$/)) {
            return this.parseDefsDirective(instruction);
        }

        // (unknown mnemonic/directive)
        return undefined;
    }

    private findBestCandidate(instruction: string, candidates: Z80Instruction[], instructionSets: string[]): Z80Instruction | undefined {

        // Locates instruction
        let bestCandidate = undefined;
        let bestScore = 0;
        for (let i = 0, n = candidates.length; i < n; i++) {
            const candidate = candidates[i];
            if (instructionSets.indexOf(candidate.getInstructionSet()) === -1) {
                // Invalid instruction set
                continue;
            }
            const score = candidate.match(instruction);
            if (score === 1) {
                // Exact match
                return candidate;
            }
            if (score > bestScore) {
                bestCandidate = candidate;
                bestScore = score;
            }
        }
        return (bestCandidate && (bestScore !== 0)) ? bestCandidate : undefined;
    }

    private parseDefbDirective(pInstruction: string): Z80Directive[] | undefined {

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
                })
            } else {
                // Raw values
                const value = this.parseNumericExpression(operand);
                bytes.push(value !== undefined ? formatHexadecimalByte(value) : "n");
            }
        });

        if (bytes.length == 0) {
            return undefined;
        }

        // Returns as directive
        return [new Z80Directive("DEFB", bytes.join(" "), bytes.length)];
    }

    private parseDefwDirective(pInstruction: string): Z80Directive[] | undefined {

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
                bytes.push("nn", "nn")
            }
        });

        if (bytes.length == 0) {
            return undefined;
        }

        // Returns as directive
        return [new Z80Directive("DEFW", bytes.join(" "), bytes.length)];
    }

    private parseDefsDirective(pInstruction: string): Z80AbstractInstruction[] | undefined {

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
            const instruction = this.instructionByOpcode[formatHexadecimalByte(opcode)];
            if (instruction) {
                return new Array(count).fill(instruction);
            }
        }

        // Returns as directive
        const byte = value !== undefined ? formatHexadecimalByte(value) : "nn";
        const bytes = new Array(count).fill(byte);
        return [new Z80Directive("DEFS", bytes.join(" "), count)];
    }

    private parseNumericExpression(s: string): number | undefined {

        for (let numericParser of Z80InstructionSet.numericParsers) {
            const value = numericParser.parse(s);
            if ((value !== undefined) && (!isNaN(value))) {
                return value;
            }
        }

        return undefined;
    }
}
