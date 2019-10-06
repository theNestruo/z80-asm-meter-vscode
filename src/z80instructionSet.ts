import { Z80Instruction } from './z80Instruction';
import { z80InstructionSetRawData } from './z80InstructionSetRawData';
import { extractMnemonicOf } from './z80Utils';

export class Z80InstructionSet {

    public static instance = new Z80InstructionSet();

    private instructionByMnemonic: Record<string, Z80Instruction[]>;

    private constructor() {

        this.instructionByMnemonic = {};
        z80InstructionSetRawData.forEach(rawData => {

            // Parses the raw instruction
            const rawInstruction = rawData[0];
            const rawZ80Timing = rawData[1];
            const rawZ80M1Timing = rawData[2];
            const rawCPCTiming = rawData[3];
            const rawOpcode = rawData[4];
            const rawSize = rawData[5];
            const instruction = new Z80Instruction(rawInstruction, rawZ80Timing, rawZ80M1Timing, rawCPCTiming, rawSize, rawOpcode);

            const mnemonic = instruction.getMnemonic();

            // Prepares a map by mnemonic for performance reasons
            if (!this.instructionByMnemonic[mnemonic]) {
                this.instructionByMnemonic[mnemonic] = [];
            }
            this.instructionByMnemonic[mnemonic].push(instruction);
        });
    }

    public parseInstruction(instruction: string | undefined): Z80Instruction | undefined {

        if (!instruction) {
            return undefined;
        }

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (!candidates) {
            return undefined;
        }

        // Locates instruction
        let bestCandidate = undefined;
        let bestScore = 0;
        for (let i = 0, n = candidates.length; i < n; i++) {
            const candidate = candidates[i];
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
