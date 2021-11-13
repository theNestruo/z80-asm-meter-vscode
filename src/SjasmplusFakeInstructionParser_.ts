import { workspace } from "vscode";
import { AbstractInstruction } from "./AbstractInstruction_";
import { AssemblyDirective } from "./AssemblyDirective_";
import { Z80Instruction } from "./Z80Instruction_";
import { z80InstructionSet } from "./data/Z80InstructionSet_";
import { extractMnemonicOf, extractOperandsOf, extractOperandsOfQuotesAware, formatHexadecimalByte } from "./utils";
import { sjasmplusFakeInstructionSet } from "./data/SjasmplusFakeInstructionSet_";
import { SjasmplusFakeInstruction } from "./SjasmplusFakeInstruction_";
import { Z80InstructionParser } from "./Z80InstructionParser_";

export class SjasmplusFakeInstructionParser {

    // Singleton
    public static instance = new SjasmplusFakeInstructionParser();

    // Instruction maps
    private instructionByMnemonic: Record<string, SjasmplusFakeInstruction[]>;

    private constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");

        // Initializes instruction maps
        this.instructionByMnemonic = {};
        sjasmplusFakeInstructionSet.forEach(rawData => {

            // Parses the raw instruction
            const instruction = new SjasmplusFakeInstruction(
                    rawData[0], // instructionSet
                    rawData[1], // fake instruction
                    rawData.slice(2)); // actual instructions

            // Prepares a map by mnemonic for performance reasons
            const mnemonic = instruction.getMnemonic();
            if (!this.instructionByMnemonic[mnemonic]) {
                this.instructionByMnemonic[mnemonic] = [];
            }
            this.instructionByMnemonic[mnemonic].push(instruction);
        });
    }

    public parse(instruction: string | undefined, instructionSets: string[]): Z80Instruction[] | undefined {

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

    private findBestCandidate(instruction: string, candidates: SjasmplusFakeInstruction[], instructionSets: string[]): Z80Instruction[] | undefined {

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
                return candidate.getInstructions();
            }
            if (score > bestScore) {
                bestCandidate = candidate;
                bestScore = score;
            }
        }
        return (bestCandidate && (bestScore !== 0)) ? bestCandidate.getInstructions() : undefined;
    }
}
