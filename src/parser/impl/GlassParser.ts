import { config } from "../../config";
import { Meterable } from "../../model/Meterable";
import { SourceCode } from "../../model/SourceCode";
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../../utils/AssemblyUtils";
import { AbstractRepetitionParser, InstructionParser } from "../Parsers";
import { z80InstructionParser } from "./Z80InstructionParser";

class GlassFakeInstructionParser implements InstructionParser {

    get isEnabled(): boolean {
        return config.syntax.glassNegativeConditionsEnabled;
    }

    parse(s: SourceCode): Meterable | undefined {

        const instruction = s.instruction;

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
        return z80InstructionParser.parseInstruction(equivalentInstruction);
    }

    private isNegatedConditionalInstruction(mnemonic: string, operands: string[]): string | undefined {

        // Is conditional instruction with negated condition?
        if (["CALL", "JP", "JR", "RET"].indexOf(mnemonic) === -1
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

    private not(condition: string): string {

        const index = ["C", "NC", "Z", "NZ", "M", "P", "PE", "PO"].indexOf(condition);
        return index !== -1
            ? ["NC", "C", "NZ", "Z", "P", "M", "PO", "PE"][index]
            : condition; // (should never happen)
    }
}

class GlassReptRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("REPT", "ENDM");
    }

    get isEnabled(): boolean {
        return config.syntax.glassReptEndmEnabled;
    }
}

export const glassFakeInstructionParser = new GlassFakeInstructionParser();
export const glassReptRepetitionParser = new GlassReptRepetitionParser();

