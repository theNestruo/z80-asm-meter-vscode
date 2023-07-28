import MeterableCollection from "../../model/MeterableCollection";
import { extractMnemonicOf, extractOperandsOf } from "../../utils/utils";
import Z80InstructionParser from "../z80/Z80InstructionParser";

export default class SjasmplusRegisterListInstructionParser {

    // Singleton
    static instance = new SjasmplusRegisterListInstructionParser();

    private constructor() {
    }

    parse(instruction: string | undefined, instructionSets: string[]): MeterableCollection | undefined {

        if (!instruction) {
            return undefined;
        }

        // Register lists instructions
        const mnemonic = extractMnemonicOf(instruction);
        if ([ "PUSH", "POP", "INC", "DEC" ].indexOf(mnemonic) === -1) {
            return undefined;
        }

        const collection = new MeterableCollection();

        for (const operand of extractOperandsOf(instruction)) {
            if (operand === "") {
                continue;
            }
            const partialInstruction = `${mnemonic} ${operand}`;

            // Tries to parse Z80 instruction
            const z80Instruction = Z80InstructionParser.instance.parseInstruction(partialInstruction, instructionSets);
            if (!z80Instruction) {
                // (unknown mnemonic/instruction)
                return undefined;
            }

            collection.add(z80Instruction);
        }
        return collection;
    }
}
