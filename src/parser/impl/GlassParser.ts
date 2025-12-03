import { config } from "../../config";
import { Meterable, SourceCode } from "../../types";
import { extractMnemonicOf, extractOperandsOf, isAnyCondition, isJrCondition } from "../../utils/AssemblyUtils";
import { OptionalSingletonHolderImpl as OptionalSingletonHolderImpl } from "../../utils/Lifecycle";
import { AbstractRepetitionParser, InstructionParser } from "../Parsers";
import { z80InstructionParser } from "./Z80InstructionParser";

class GlassFakeInstructionParserHolder extends OptionalSingletonHolderImpl<GlassFakeInstructionParser> {

    protected get enabled(): boolean {
        return config.syntax.glassNegativeConditions;
    }

    protected createInstance(): GlassFakeInstructionParser {
        return new GlassFakeInstructionParser();
    }
}

export const glassFakeInstructionParser = new GlassFakeInstructionParserHolder();

//

class GlassReptRepetitionParserHolder extends OptionalSingletonHolderImpl<GlassReptRepetitionParser> {

    protected get enabled(): boolean {
        return config.syntax.glassReptEndmRepetition;
    }

    protected createInstance(): GlassReptRepetitionParser {
        return new GlassReptRepetitionParser();
    }
}

export const glassReptRepetitionParser = new GlassReptRepetitionParserHolder();

//

/**
 * Actual implementation of the Glass fake instruction parser
 */
class GlassFakeInstructionParser implements InstructionParser {

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
        return z80InstructionParser.instance.parseInstruction(equivalentInstruction);
    }

    private isNegatedConditionalInstruction(mnemonic: string, operands: string[]): string | undefined {

        // Is conditional instruction with negated condition?
        if (!["CALL", "JP", "JR", "RET"].includes(mnemonic)
            || !operands
            || operands.length < (mnemonic === "RET" ? 1 : 2)
            || operands[0].charAt(0) !== "!") {
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

/**
 * Actual implementation of the Glass REPT/ENDM repetition parser
 */
class GlassReptRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("REPT", "ENDM");
    }
}

