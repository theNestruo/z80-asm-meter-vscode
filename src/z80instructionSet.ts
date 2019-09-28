import { Z80Instruction } from './z80instruction';
import { extractMnemonicOf } from './z80utils';
import { z80InstructionSetRawData } from './z80InstructionSetRawData';

export class Z80InstructionSet {

    private instructionByMnemonic: Record<string, Z80Instruction[]>;

    constructor() {

        this.instructionByMnemonic = {};
        z80InstructionSetRawData.forEach(rawData => {

            // Parses the raw instruction
            const rawInstruction = rawData[0];
            const rawZ80Timing = rawData[1];
            const rawZ80M1Timing = rawData[2];
            const rawCPCTiming = rawData[5];
           
            const rawSize = rawData[7];
            const instruction = new Z80Instruction(rawInstruction, rawZ80Timing, rawZ80M1Timing, rawCPCTiming, rawSize);
           
            const mnemonic = instruction.getMnemonic();

            // Prepares a map by mnemonic for performance reasons
            if (!this.instructionByMnemonic[mnemonic]) {
                this.instructionByMnemonic[mnemonic] = [];
            }
            this.instructionByMnemonic[mnemonic].push(instruction);
        });
    }

    public parseInstruction(line: string): Z80Instruction | undefined {

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(line);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (!candidates) {
            return undefined;
        }

        // Locates instruction
        let bestCandidate = undefined;
        let bestScore = 0;
        for (let i = 0, n = candidates.length; i < n; i++) {
            const candidate = candidates[i];
            const score = candidate.match(line);
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
