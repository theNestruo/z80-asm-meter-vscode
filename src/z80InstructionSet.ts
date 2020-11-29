import { Z80Instruction } from './z80Instruction';
import { z80InstructionSetRawData } from './z80InstructionSetRawData';
import { extractMnemonicOf, extractOperandsOf } from './z80Utils';

export class Z80InstructionSet {

    public static instance = new Z80InstructionSet();

    private instructionByMnemonic: Record<string, Z80Instruction[]>;

    private instructionByOpcode: Record<string, Z80Instruction>;

    private constructor() {

        this.instructionByMnemonic = {};
        this.instructionByOpcode = {};
        z80InstructionSetRawData.forEach(rawData => {

            // Parses the raw instruction
            const instruction = new Z80Instruction(
                    rawData[0], // instructionSet
                    rawData[1], // raw instruction
                    rawData[2], // z80Timing
                    rawData[3], // msxTiming
                    rawData[4], // cpcTiming
                    rawData[5], // opcode
                    rawData[6]); // size

            // Prepares a map by mnemonic for performance reasons
            const mnemonic = instruction.getMnemonic();
            if (!this.instructionByMnemonic[mnemonic]) {
                this.instructionByMnemonic[mnemonic] = [];
            }
            this.instructionByMnemonic[mnemonic].push(instruction);

            // Prepares a map by opcode for single byte instructions
            if (instruction.getSize() == 1) {
                const opcode = instruction.getOpcode();
                this.instructionByOpcode[opcode] = instruction;
            }
        });
    }

    public parseInstructions(instruction: string | undefined, instructionSets: string[]): Z80Instruction[] | undefined {

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

        // Locates DEFS directive
        if (mnemonic.match(/^(DEFS|DS)$/)) {
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

    private parseDefsDirective(pInstruction: string): Z80Instruction[] | undefined {

        const operands = extractOperandsOf(pInstruction);
        if ((operands.length < 1) ||(operands.length > 2)) {
            return undefined;
        }

        // Extracts count and opcode
        const count = parseInt(operands[0]);
        if (isNaN(count)) {
            return undefined;
        }
        const opcode = operands.length == 2 ? operands[1] : "00";

        // Determines instruction
        const instruction = this.instructionByOpcode[opcode];
        if (!instruction) {
            return undefined;
        }

        return new Array(count).fill(instruction);
    }
}
