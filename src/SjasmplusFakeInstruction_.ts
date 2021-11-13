import { extractIndirection, extractMnemonicOf, extractOperandsOf, extractRawInstructionFrom, isAnyRegister, isIndirectionOperand, isIXhScore, isIXlScore, isIXWithOffsetScore, isIYhScore, isIYlScore, isIYWithOffsetScore, isVerbatimOperand, sdccIndexRegisterIndirectionScore, verbatimOperandScore } from "./utils";
import { Z80InstructionParser } from "./Z80InstructionParser_";
import { Z80Instruction } from "./Z80Instruction_";

/**
 * A sjasmplus fake instruction
 */
export class SjasmplusFakeInstruction {

	// Information
    private instructionSet: string;
	private fakeInstruction: string;
	private rawInstructions: string[];

	// Derived information (will be cached for performance reasons)
	private mnemonic: string | undefined;
	private operands: string[] | undefined;
	private instructions: Z80Instruction[] | undefined;

	constructor(
			instructionSet: string, fakeInstruction: string,
			rawInstructions: string[]) {

		this.instructionSet = instructionSet;
		this.fakeInstruction = fakeInstruction;
		this.rawInstructions = rawInstructions;

		this.mnemonic = undefined;
		this.operands = undefined;
	}

    /**
     * @returns The instruction set
     */
     public getInstructionSet(): string {
        return this.instructionSet;
    }

    /**
     * @returns the mnemonic
     */
	 public getMnemonic(): string {
        return this.mnemonic
                ? this.mnemonic
                : this.mnemonic = extractMnemonicOf(this.fakeInstruction);
    }

    /**
     * @returns the operands
     */
    public getOperands(): string[] {
        return this.operands
                ? this.operands
                : this.operands = extractOperandsOf(this.fakeInstruction);
    }

    public getInstructions(): Z80Instruction[] {
        if (!this.instructions) {
            var lInstructions: Z80Instruction[] = [];
            this.rawInstructions.forEach(rawPart => {
                const rawInstruction = extractRawInstructionFrom(rawPart);
                var lInstruction = Z80InstructionParser.instance.parseInstruction(rawInstruction, [this.instructionSet]);
                if (lInstruction) {
                    lInstructions.push(lInstruction);
                } else {
                    lInstructions = lInstructions;
                }
            });
            this.instructions = lInstructions;
        }
        return this.instructions;
    }

    /**
     * @param candidateInstruction the cleaned-up line to match against the instruction
     * @returns number between 0 and 1 with the score of the match,
     * where 0 means the line is not this instruction,
     * 1 means the line is this instruction,
     * and intermediate values mean the line may be this instruction
     */
	 public match(candidateInstruction: string): number {

        // Compares mnemonic
        if (extractMnemonicOf(candidateInstruction) !== this.mnemonic) {
            return 0;
        }

        // Extracts the candidate operands
        const candidateOperands = extractOperandsOf(candidateInstruction);
        for (let i = 0, n = candidateOperands.length; i < n; i++) {
            if (candidateOperands[i] === "") {
                return 0; // (incomplete candidate instruction, such as "LD A,")
            }
        }

        const candidateOperandsLength = candidateOperands.length;
        const expectedOperands = this.getOperands();
        const expectedOperandsLength = expectedOperands.length;

        // Compares operand count
        if (candidateOperandsLength !== expectedOperandsLength) {
			return 0;
        }

        // Compares operands
        let score = 1;
        for (let i = 0; i < expectedOperands.length; i++) {
            score *= this.operandScore(expectedOperands[i], candidateOperands[i], true);
            if (score === 0) {
                return 0;
            }
        }
        return score;
    }

    /**
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @param indirectionAllowed true to allow indirection
     * @returns number between 0 and 1 with the score of the match,
     * where 0 means the candidate operand is not valid,
     * 1 means the candidate operand is a perfect match,
     * and intermediate values mean the operand is accepted
     */
	 private operandScore(expectedOperand: string, candidateOperand: string, indirectionAllowed: boolean): number {

        // Must the candidate operand match verbatim the operand of the instruction?
        if (isVerbatimOperand(expectedOperand)) {
            return verbatimOperandScore(expectedOperand, candidateOperand);
        }

        // Must the candidate operand be an indirection?
        if (indirectionAllowed && isIndirectionOperand(expectedOperand, true)) {
            return this.indirectOperandScore(expectedOperand, candidateOperand);
        }

        // Depending on the expected operand...
        switch (expectedOperand) {
        case "IX+o":
            return isIXWithOffsetScore(candidateOperand);
        case "IY+o":
            return isIYWithOffsetScore(candidateOperand);
        case "IXh":
            return isIXhScore(candidateOperand);
        case "IXl":
            return isIXlScore(candidateOperand);
        case "IYh":
            return isIYhScore(candidateOperand);
        case "IYl":
            return isIYlScore(candidateOperand);
        default:
            // (due possibility of using constants, labels, and expressions in the source code,
            // there is no proper way to discriminate: b, n, nn, o, 0, 8H, 10H, 20H, 28H, 30H, 38H;
            // but uses a "best effort" to discard registers)
            return isAnyRegister(
                    isIndirectionOperand(candidateOperand, false)
                        ? extractIndirection(candidateOperand)
                        : candidateOperand)
                    ? 0
                    : 0.75;
        }
    }

    /**
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @returns number between 0 and 1 with the score of the match,
     * or 0 if the candidate operand is not valid
     */
     private indirectOperandScore(expectedOperand: string, candidateOperand: string): number {

        // Compares the expression inside the indirection
        return isIndirectionOperand(candidateOperand, false)
                ? this.operandScore(extractIndirection(expectedOperand), extractIndirection(candidateOperand), false)
                : 0;
    }
}
