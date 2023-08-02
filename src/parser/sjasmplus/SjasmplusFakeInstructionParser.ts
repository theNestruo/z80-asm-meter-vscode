import { extractMnemonicOf } from "../../utils/utils";
import { sjasmplusFakeInstructionSet } from "./data/SjasmplusFakeInstructionSet";
import SjasmplusFakeInstruction from "./model/SjasmplusFakeInstruction";

export default class SjasmplusFakeInstructionParser {

    // Singleton
    static instance = new SjasmplusFakeInstructionParser();

    // Instruction maps
    private instructionByMnemonic: Record<string, SjasmplusFakeInstruction[]>;

    private constructor() {

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

    parse(instruction: string, instructionSets: string[]): SjasmplusFakeInstruction | undefined {

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            return this.findBestCandidate(instruction, candidates, instructionSets);
        }

        // (unknown mnemonic/instruction)
        return undefined;
    }

    private findBestCandidate(instruction: string,
        candidates: SjasmplusFakeInstruction[], instructionSets: string[]): SjasmplusFakeInstruction | undefined {

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
