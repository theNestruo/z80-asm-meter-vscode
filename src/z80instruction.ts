import { parseTimings, extractMnemonicOf, extractOperandsOf } from './z80utils';

export class Z80Instruction {

    private instruction: string;
    private z80Timing: number[];
    private z80M1Timing: number[];
    private cpcTiming: number[];
    private size: number;
    private mnemonic: string | undefined;
    private operands: string[] | undefined;
    private implicitAccumulatorSyntaxAllowed: boolean | undefined;

    constructor(instruction: string, z80Timing: string, z80M1Timing: string, cpcTiming: string, size: string) {

        this.instruction = instruction;
        this.z80Timing = parseTimings(z80Timing);
        this.z80M1Timing = parseTimings(z80M1Timing);
        this.cpcTiming = parseTimings(cpcTiming);
        this.size = parseInt(size);
    }

    /**
     * @returns The raw instruction
     */
    public getInstruction(): string {
        return this.instruction;
    }

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
    public getZ80Timing(): number[] {
        return this.z80Timing;
    }

    /**
     * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
     */
    public getZ80M1Timing(): number[] {
        return this.z80M1Timing;
    }

    /**
     * @returns The CPC timing, in NOPS
     */
    public getCPCTiming(): number[] {
        return this.cpcTiming;
    }

    /**
     * @returns The size in bytes
     */
    public getSize(): number {
        return this.size;
    }

    /**
     * @returns the mnemonic
     */
    public getMnemonic(): string {
        return this.mnemonic
                ? this.mnemonic
                : this.mnemonic = extractMnemonicOf(this.instruction);
    }

    /**
     * @returns the operands
     */
    public getOperands(): string[] {
        return this.operands
                ? this.operands
                : this.operands = extractOperandsOf(this.instruction);
    }

    /**
     * @returns true if this operation allows implicit accumulator syntax
     * (it's mnemonic is not LD, there are two operands, and the first one is A)
     */
    private isImplicitAccumulatorSyntaxAllowed(): boolean {

        if (this.implicitAccumulatorSyntaxAllowed) {
            return this.implicitAccumulatorSyntaxAllowed;
        }

        if (this.getMnemonic() === "LD") {
            return this.implicitAccumulatorSyntaxAllowed = false;
        }
        const operands = this.getOperands();
        return this.implicitAccumulatorSyntaxAllowed = operands.length === 2 && operands[0] === "A";
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

        // Compares operand count
        const expectedOperands = this.getOperands();
        const expectedOperandsLength = expectedOperands.length;
        const candidateOperands = extractOperandsOf(candidateInstruction);
        let implicitAccumulatorSyntax = false;
        if (candidateOperands.length !== expectedOperandsLength) {
            if (candidateOperands.length !== expectedOperandsLength - 1) {
                return 0;
            }
            // Checks implicit accumulator syntax
            implicitAccumulatorSyntax = this.isImplicitAccumulatorSyntaxAllowed();
            if (!implicitAccumulatorSyntax) {
                return 0;
            }
        }

        // Compares oprands
        let score = 1;
        for (var i = implicitAccumulatorSyntax ? 1 : 0, j = 0; i < expectedOperandsLength; i++, j++) {
            score *= this.operandScore(expectedOperands[i], candidateOperands[j], true);
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
        if (this.isVerbatimOperand(expectedOperand)) {
            return this.verbatimOperandScore(expectedOperand, candidateOperand);
        }

        // Must the candidate operand be an indirection?
        if (indirectionAllowed && this.isIndirectionOperand(expectedOperand, true)) {
            return this.indirectOperandScore(expectedOperand, candidateOperand);
        }

        // Depending on the
        switch (expectedOperand) {
        case "r":
            return this.is8bitRegisterScore(candidateOperand);
        case "IX+o":
            return this.isIXWithOffsetScore(candidateOperand);
        case "IY+o":
            return this.isIYWithOffsetScore(candidateOperand);
        case "IXp":
            return this.isIX8bitScore(candidateOperand);
        case "IYq":
            return this.isIY8bitScore(candidateOperand);
        case "p":
            return this.is8bitRegisterReplacingHLByIX8bitScore(candidateOperand);
        case "q":
            return this.is8bitRegisterReplacingHLByIY8bitScore(candidateOperand);
        default:
            // (due possibility of using constants, labels, and expressions in the source code,
            // there is no proper way to discriminate: b, n, nn, o, 0, 8H, 10H, 20H, 28H, 30H, 38H)
            return 0.75;
        }
    }

    /**
     * @param operand the operand of the instruction
     * @returns true if the candidate operand must match verbatim the operand of the instruction
     */
    private isVerbatimOperand(operand: string): boolean {
        return !!operand.match(/^(A|AF'?|BC?|N?C|DE?|E|HL?|L|I|I[XY][hl]?|R|SP|N?Z|M|P[OE]?)$/);
    }

    /**
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @returns 1 if the candidate operand is a perfect match,
     * 0 if the candidate operand is not valid
     */
    private verbatimOperandScore(expectedOperand: string, candidateOperand: string): number {

        return ((candidateOperand === expectedOperand.toUpperCase())
                || (candidateOperand === "IXU" && expectedOperand === "IXh")) ? 1 : 0;
    }

    /**
     * @param operand the operand of the instruction or the candidate operand
     * @param strict true to only accept parenthesis, false to also accept brackets
     */
    private isIndirectionOperand(operand: string, strict: boolean): boolean {

        if (operand.startsWith("(") && operand.endsWith(")")) {
            return true;
        }
        if (strict) {
            return false;
        }
        return (operand.startsWith("[") && operand.endsWith("]"));
    }

    /**
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @returns number between 0 and 1 with the score of the match,
     * or 0 if the candidate operand is not valid
     */
    private indirectOperandScore(expectedOperand: string, candidateOperand: string): number {

        // Compares the expression inside the indirection
        return this.isIndirectionOperand(candidateOperand, false)
                ? this.operandScore(this.extractIndirection(expectedOperand), this.extractIndirection(candidateOperand), false)
                : 0;
    }

    /**
     * @param operand the operand of the instruction or the candidate operand
     * @returns the expression inside the indirection
     */
    private extractIndirection(operand: string): string {
        return operand.substring(1, operand.length - 1);
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is one of the 8 bit general purpose registers, 0 otherwise
     */
    private is8bitRegisterScore(operand: string): number {
        return operand.match(/^[ABCDEHL]$/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the IX index register with an optional offset, 0 otherwise
     */
    private isIXWithOffsetScore(operand: string): number {
        return operand.match(/^IX\W/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the IY index register with an optional offset, 0 otherwise
     */
    private isIYWithOffsetScore(operand: string): number {
        return operand.match(/^IY\W/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the high or low part of the IX index register, 0 otherwise
     */
    private isIX8bitScore(operand: string): number {
        return operand.match(/^(IX[HLU]|X[HL]|[HL]X)$/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the high or low part of the IY index register, 0 otherwise
     */
    private isIY8bitScore(operand: string): number {
        return operand.match(/^(IY[HLU]|Y[HL]|[HL]Y)$/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is a register where H and L have been replaced by IXh and IXl, 0 otherwise
     */
    private is8bitRegisterReplacingHLByIX8bitScore(operand: string): number {
        return operand.match(/^[ABCDE]$/) ? 1 : this.isIX8bitScore(operand);
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is a register where H and L have been replaced by IYh and IYl, 0 otherwise
     */
    private is8bitRegisterReplacingHLByIY8bitScore(operand: string): number {
        return operand.match(/^[ABCDE]$/) ? 1 : this.isIY8bitScore(operand);
    }
}
