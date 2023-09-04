import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../../utils/AssemblyUtils";
import Z80InstructionParser from "../z80/Z80InstructionParser";
import Z80Instruction from "../z80/model/Z80Instruction";

export default class GlassFakeInstructionParser {

    static parse(instruction: string, instructionSets: string[]): Z80Instruction | undefined {

        const mnemonic = extractMnemonicOf(instruction);
        const operands = extractOperandsOf(instruction);

        // Is conditional instruction with valid negated condition?
        const negatedCondition = this.isNegatedConditionalInstruction(mnemonic, operands);
		if (!negatedCondition) {
            return undefined;
        }

        // Replaces with non-negated condition equivalent instruction
        operands[0] = this.not(negatedCondition);
        const equivalentInstruction = mnemonic + " " + operands.join(",");
        return Z80InstructionParser.instance.parseInstruction(equivalentInstruction, instructionSets);
    }

    private static isNegatedConditionalInstruction(mnemonic: string, operands: string[]): string | undefined {

        // Is conditional instruction with negated condition?
		if ([ "CALL", "JP", "JR", "RET" ].indexOf(mnemonic) === -1
            || !operands
            || operands.length < (mnemonic === "RET" ? 1 : 2)
            || operands[0].charAt(0) !== '!') {
            return undefined;
        }

        // Is valid negated condition?
        const negatedCondition = operands[0].substring(1).trimStart();
		switch (mnemonic) {
        case "CALL":
        case "JP":
        case "RET":
            return isAnyCondition(negatedCondition) ? negatedCondition : undefined;
        case "JR":
            return isJrCondition(negatedCondition) ? negatedCondition : undefined;
        default:
            return undefined;
        }
    }

    private static not(condition: string): string {

        const index = ["C", "NC", "Z", "NZ", "M", "P", "PE", "PO"].indexOf(condition);
        return index !== -1
            ? ["NC", "C", "NZ", "Z", "P", "M", "PO", "PE"][index]
            : condition; // (should never happen)
    }
}
