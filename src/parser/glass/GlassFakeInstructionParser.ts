import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../../utils/utils";
import Z80InstructionParser from "../z80/Z80InstructionParser";
import Z80Instruction from "../z80/model/Z80Instruction";

export default class GlassFakeInstructionParser {

    // Singleton
    static instance = new GlassFakeInstructionParser();

    parse(instruction: string, instructionSets: string[]): Z80Instruction | undefined {

        const mnemonic = extractMnemonicOf(instruction);
        const operands = extractOperandsOf(instruction);

		if (!this.isNegatedConditionalInstruction(mnemonic, operands)) {
            return undefined;
        }

        const negatedCondition = operands[0].substring(1).trimStart();
        const condition = this.not(negatedCondition);
        if (condition === negatedCondition) {
            // (should never happen)
            return undefined;
        }

        operands[0] = condition;
        const equivalentInstruction = mnemonic + " " + operands.join(",");
        return Z80InstructionParser.instance.parseInstruction(equivalentInstruction, instructionSets);
    }

    private isNegatedConditionalInstruction(mnemonic: string, operands: string[]): boolean {

        // Conditional instruction
		if ([ "CALL", "JP", "JR", "RET" ].indexOf(mnemonic) === -1
            || !operands
            || operands.length < (mnemonic === "RET" ? 1 : 2)
            || operands[0].charAt(0) !== '!') {
            return false;
        }

        const negatedCondition = operands[0].substring(1).trimStart();
		switch (mnemonic) {
        case "CALL":
        case "JP":
        case "RET":
            return isAnyCondition(negatedCondition);
        case "JR":
            return isJrCondition(negatedCondition);
        default:
            return false;
        }
    }

    private not(condition: string): string {

        const index = ["C", "NC", "Z", "NZ", "M", "P", "PE", "PO"].indexOf(condition);
        return index !== -1
            ? ["NC", "C", "NZ", "Z", "P", "M", "PO", "PE"][index]
            : condition; // (should never happen)
    }
}
