import { workspace } from "vscode";
import { z80InstructionSet } from "./data/Z80InstructionSet";
import { extractMnemonicOf, formatHexadecimalByte } from "./utils";
import { Z80Instruction } from "./Z80Instruction";

export class Z80InstructionParser {

    // Singleton
    public static instance = new Z80InstructionParser();

    // Instruction maps
    private instructionByMnemonic: Record<string, Z80Instruction[]>;
    private instructionByOpcode: Record<string, Z80Instruction>;

    private constructor() {

        // Initializes instruction maps
        this.instructionByMnemonic = {};
        this.instructionByOpcode = {};
        z80InstructionSet.forEach(rawData => {

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

    public parseInstruction(instruction: string | undefined, instructionSets: string[]): Z80Instruction | undefined {

        if (!instruction) {
            return undefined;
        }

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            return this.findBestCandidate(instruction, candidates, instructionSets);
        }

        // (unknown mnemonic/instruction)
        return undefined;
    }

    public parseOpcode(opcode: number): Z80Instruction | undefined {

        return this.instructionByOpcode[formatHexadecimalByte(opcode)];
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
}
