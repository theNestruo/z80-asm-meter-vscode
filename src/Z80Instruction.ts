import { Meterable } from './Meterable';
import { NumericExpressionParser } from './NumericExpressionParser';
import { extractIndirection, extractMnemonicOf, extractOperandsOf, formatHexadecimalByte, formatTiming, is8bitRegisterReplacingHLByIX8bitScore, is8bitRegisterReplacingHLByIY8bitScore, is8bitRegisterScore, isAnyRegister, isIndirectionOperand, isIX8bitScore, isIXhScore, isIXlScore, isIXWithOffsetScore, isIY8bitScore, isIYhScore, isIYlScore, isIYWithOffsetScore, isVerbatimOperand, parseTimings, sdccIndexRegisterIndirectionScore, verbatimOperandScore } from './utils';

/**
 * A Z80 instruction
 */
export class Z80Instruction implements Meterable {

    private instructionSet: string;

    // Information
    private instruction: string;
    private z80Timing: number[];
    private msxTiming: number[];
    private cpcTiming: number[];
    private opcodes: string;
    private size: number;

    // Derived information (will be cached for performance reasons)
    private mnemonic: string | undefined;
    private operands: string[] | undefined;
    private implicitAccumulatorSyntaxAllowed: boolean | undefined;
    private explicitAccumulatorSyntaxAllowed: boolean | undefined;

    constructor(
        instructionSet: string, instruction: string,
        z80Timing: string, msxTiming: string, cpcTiming: string,
        opcodes: string, size: string) {

        this.instructionSet = instructionSet;

        this.instruction = instruction;
        this.z80Timing = parseTimings(z80Timing);
        this.msxTiming = parseTimings(msxTiming);
        this.cpcTiming = parseTimings(cpcTiming);
        this.opcodes = opcodes;
        this.size = parseInt(size);
    }

    /**
     * @returns The instruction set this instruction belongs to
     */
    public getInstructionSet(): string {
        return this.instructionSet;
    }

    /**
     * @returns The normalized Z80 instruction
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
    public getMsxTiming(): number[] {
        return this.msxTiming;
    }

    /**
     * @returns The CPC timing, in NOPS
     */
    public getCpcTiming(): number[] {
        return this.cpcTiming;
    }

    /**
     * @returns The opcodes of the instruction (bytes)
     */
    public getBytes(): string[] {
        return [this.opcodes];
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
     * @returns an array of Z80Instruction, expanded from the actual instruction
     */
    public expanded(): Z80Instruction[] {

        var expandableIndex = this.opcodes.indexOf("+");
        if (expandableIndex == -1) {
            // Not expandable
            return [this];
        }

        var expandableExpression = this.opcodes.substring(expandableIndex);

        // Expands bit and 8bit register
        if (expandableExpression.substring(0, 6) === "+8*b+r") {
            const ret: Z80Instruction[] = [];
            for (var bit = 0; bit <= 7; bit++) {
                const expandedBit = this.expandedBit(this, bit);
                ret.push(...this.expanded8bitRegisters(expandedBit), expandedBit);
            }
            // (keeps unexpanded bit instructions)
            ret.push(...this.expanded8bitRegistersAfterBit(this), this);
            return ret;
        }

        // Expands bit
        if (expandableExpression.substring(0, 4) === "+8*b") {
            // (keeps unexpanded bit instruction)
            return [ this, ...this.expandedBits(this) ];
        }

        if (expandableExpression.substring(0, 4) === "+8*p") {
        }

        if (expandableExpression.substring(0, 4) === "+8*q") {
        }

        if (expandableExpression.substring(0, 2) === "+p") {
        }

        if (expandableExpression.substring(0, 2) === "+q") {
        }

        // Expands 8bit register
        if (expandableExpression.substring(0, 2) === "+r") {
            return this.expanded8bitRegisters(this);
        }

        return [this];
    }

    private expandedBits(base: Z80Instruction): Z80Instruction[] {

        return [
                this.expandedBit(base, 0),
                this.expandedBit(base, 1),
                this.expandedBit(base, 2),
                this.expandedBit(base, 3),
                this.expandedBit(base, 4),
                this.expandedBit(base, 5),
                this.expandedBit(base, 6),
                this.expandedBit(base, 7)
            ];
    }

    private expandedBit(base: Z80Instruction, bit: number): Z80Instruction {

        const expandedInstruction = base.instruction.replace(/b/, bit.toString());
        const index = base.opcodes.indexOf("+8*b") - 2;
        const prefix = base.opcodes.substring(0, index);
        const baseValue = parseInt(base.opcodes.substring(index, index + 2), 16);
        const suffix = base.opcodes.substring(index + 6); // "00+8*b"
        const expandedOpcodes = prefix + formatHexadecimalByte(baseValue + 8 * bit) + suffix;

        return new Z80Instruction(
            base.instructionSet,
            expandedInstruction,
            formatTiming(base.z80Timing),
            formatTiming(base.msxTiming),
            formatTiming(base.cpcTiming),
            expandedOpcodes,
            base.size.toString());
    }

    private expanded8bitRegisters(base: Z80Instruction): Z80Instruction[] {

        return [
                this.expanded8bitRegister(base, 'A', 7),
                this.expanded8bitRegister(base, 'B', 0),
                this.expanded8bitRegister(base, 'C', 1),
                this.expanded8bitRegister(base, 'D', 2),
                this.expanded8bitRegister(base, 'E', 3),
                this.expanded8bitRegister(base, 'H', 4),
                this.expanded8bitRegister(base, 'L', 5)
            ];
    }

    private expanded8bitRegister(base: Z80Instruction, register: string, addend: number): Z80Instruction {

        const expandedInstruction = base.instruction.replace(/r/, register);
        const index = base.opcodes.indexOf("+r") - 2;
        const prefix = base.opcodes.substring(0, index);
        const baseValue = parseInt(base.opcodes.substring(index, index + 2), 16);
        const suffix = base.opcodes.substring(index + 4); // "00+r"
        const expandedOpcodes = prefix + formatHexadecimalByte(baseValue + addend) + suffix;

        return new Z80Instruction(
                base.instructionSet,
                expandedInstruction,
                formatTiming(base.z80Timing),
                formatTiming(base.msxTiming),
                formatTiming(base.cpcTiming),
                expandedOpcodes,
                base.size.toString());
    }

    private expanded8bitRegistersAfterBit(base: Z80Instruction): Z80Instruction[] {

        return [
                this.expanded8bitRegisterAfterBit(base, 'A', 7),
                this.expanded8bitRegisterAfterBit(base, 'B', 0),
                this.expanded8bitRegisterAfterBit(base, 'C', 1),
                this.expanded8bitRegisterAfterBit(base, 'D', 2),
                this.expanded8bitRegisterAfterBit(base, 'E', 3),
                this.expanded8bitRegisterAfterBit(base, 'H', 4),
                this.expanded8bitRegisterAfterBit(base, 'L', 5)
            ];
    }

    private expanded8bitRegisterAfterBit(base: Z80Instruction, register: string, addend: number): Z80Instruction {

        const expandedInstruction = base.instruction.replace(/r/, register);
        const index = base.opcodes.indexOf("+8*b+r") - 2;
        const prefix = base.opcodes.substring(0, index);
        const baseValue = parseInt(base.opcodes.substring(index, index + 2), 16);
        const suffix = "+8*b" + base.opcodes.substring(index + 8); // "00+8*b+r"
        const expandedOpcodes = prefix + formatHexadecimalByte(baseValue + addend) + suffix;

        return new Z80Instruction(
                base.instructionSet,
                expandedInstruction,
                formatTiming(base.z80Timing),
                formatTiming(base.msxTiming),
                formatTiming(base.cpcTiming),
                expandedOpcodes,
                base.size.toString());
    }

    /**
     * @returns true if this operation allows implicit accumulator syntax
     * (it's mnemonic is not LD, there are two operands, and the first one is A)
     */
    private isImplicitAccumulatorSyntaxAllowed(): boolean {

        if (this.implicitAccumulatorSyntaxAllowed !== undefined) {
            return this.implicitAccumulatorSyntaxAllowed;
        }

        if (this.getMnemonic() === "LD") {
            return this.implicitAccumulatorSyntaxAllowed = false;
        }
        const operands = this.getOperands();
        return this.implicitAccumulatorSyntaxAllowed = operands.length === 2 && operands[0] === "A";
    }

    /**
     * @returns true if this operation allows SDCC explicit accumulator syntax
     * (it's mnemonic is ADC, ADD, AND, CP, DEC, INC, OR, RL, RLC, RR, RRC, SBC, SLA, SRA, SRL, SUB, or XOR,
     * and  there is one single operand)
     */
    private isExplicitAccumulatorSyntaxAllowed(): boolean {

        if (this.explicitAccumulatorSyntaxAllowed !== undefined) {
            return this.explicitAccumulatorSyntaxAllowed;
        }

        if (!this.getMnemonic().match(/^(ADC|ADD|AND|CP|DEC|INC|OR|RL|RLC|RR|RRC|SBC|SLA|SRA|SRL|SUB|XOR)$/)) {
            return this.explicitAccumulatorSyntaxAllowed = false;
        }
        const operands = this.getOperands();
        return this.explicitAccumulatorSyntaxAllowed = operands.length === 1;
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
        let implicitAccumulatorSyntax = false;
        let explicitAccumulatorSyntax = false;
        if (candidateOperandsLength !== expectedOperandsLength) {

            // Checks implicit accumulator syntax
            if (candidateOperands.length === expectedOperands.length - 1) {
                if (!(implicitAccumulatorSyntax = this.isImplicitAccumulatorSyntaxAllowed())) {
                    return 0;
                }

                // Checks explicit accumulator syntax
            } else if (candidateOperands.length === expectedOperands.length + 1) {
                if ((!(explicitAccumulatorSyntax = this.isExplicitAccumulatorSyntaxAllowed()))
                    || (candidateOperands[0] !== "A")) {
                    return 0;
                }

                // Operand count mismatch
            } else {
                return 0;
            }
        }

        // Compares operands
        let score = 1;
        for (let i = implicitAccumulatorSyntax ? 1 : 0, j = explicitAccumulatorSyntax ? 1 : 0;
            i < expectedOperands.length;
            i++, j++) {
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
        if (isVerbatimOperand(expectedOperand)) {
            return verbatimOperandScore(expectedOperand, candidateOperand);
        }

        // Must the candidate operand be an indirection?
        if (indirectionAllowed && isIndirectionOperand(expectedOperand, true)) {
            // Checks for SDCC index register syntax
            const score = sdccIndexRegisterIndirectionScore(expectedOperand, candidateOperand);
            if (score !== undefined) {
                return score;
            }
            return this.indirectOperandScore(expectedOperand, candidateOperand);
        }

        // Depending on the expected operand...
        switch (expectedOperand) {
            case "r":
                return is8bitRegisterScore(candidateOperand);
            case "IX+o":
                return isIXWithOffsetScore(candidateOperand);
            case "IY+o":
                return isIYWithOffsetScore(candidateOperand);
            case "IXh":
                return isIXhScore(candidateOperand);
            case "IXl":
                return isIXlScore(candidateOperand);
            case "IXp":
                return isIX8bitScore(candidateOperand);
            case "IYh":
                return isIYhScore(candidateOperand);
            case "IYl":
                return isIYlScore(candidateOperand);
            case "IYq":
                return isIY8bitScore(candidateOperand);
            case "p":
                return is8bitRegisterReplacingHLByIX8bitScore(candidateOperand);
            case "q":
                return is8bitRegisterReplacingHLByIY8bitScore(candidateOperand);
            case "0":   // BIT/SET/RES, IM 0, RST 0, and OUT (C), 0
            case "1":   // BIT/SET/RES, IM 1
            case "2":   // BIT/SET/RES, IM 2
            case "3":   // BIT/SET/RES
            case "4":   // BIT/SET/RES
            case "5":   // BIT/SET/RES
            case "6":   // BIT/SET/RES
            case "7":   // BIT/SET/RES
            case "8H":  // RST 8H
            case "10H": // RST 10H
            case "18H": // RST 18H
            case "20H": // RST 20H
            case "28H": // RST 28H
            case "30H": // RST 30H
            case "38H": // RST 38H
                const candidateNumber = NumericExpressionParser.parse(candidateOperand);
                if (candidateNumber !== undefined) {
                    return (candidateNumber === NumericExpressionParser.parse(expectedOperand))
                            ? 1 // (exact match)
                            : 0; // (discards match; will default to unexpadned instruction if exists)
                }
                // falls-through
            default:
                // (due possibility of using constants, labels, and expressions in the source code,
                // there is no proper way to discriminate: b, n, nn, o, 0-7, 8H, 10H, 18H, 20H, 28H, 30H, 38H;
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
