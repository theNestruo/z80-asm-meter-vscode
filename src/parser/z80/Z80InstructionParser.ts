import { extractMnemonicOf, formatHexadecimalByte } from "../../utils/utils";
import { z80InstructionSet } from "./data/Z80InstructionSet";
import Z80Instruction from "./model/Z80Instruction";

export default class Z80InstructionParser {

    // Singleton
    static instance = new Z80InstructionParser();

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

            originalInstruction.expanded().forEach(instruction => {
                // Prepares a map by mnemonic for performance reasons
                const mnemonic = instruction.getMnemonic();
                if (!this.instructionByMnemonic[mnemonic]) {
                    this.instructionByMnemonic[mnemonic] = [];
                }
                this.instructionByMnemonic[mnemonic].push(instruction);

                // Prepares a map by opcode for single byte instructions
                if (instruction.getSize() === 1) {
                    const opcode = instruction.getBytes()[0];
                    this.instructionByOpcode[opcode] = instruction;
                }
            });
        });
    }

    parseInstruction(instruction: string, instructionSets: string[]): Z80Instruction | undefined {

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            return this.findBestCandidate(instruction, candidates, instructionSets);
        }

        // (unknown mnemonic/instruction)
        return undefined;
    }

    parseOpcode(opcode: number): Z80Instruction | undefined {

        return this.instructionByOpcode[formatHexadecimalByte(opcode)];
    }

    private findBestCandidate(instruction: string,
        candidates: Z80Instruction[], instructionSets: string[]): Z80Instruction | undefined {

        // Locates instruction
        let bestCandidate;
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
