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
    public expand(): Z80Instruction[] {

        if (!this.isExpandable()) {
            return [this];
        }

        // Expands the bit
        var expandedBit: Z80Instruction[] = [this];
        if (this.hasExpandableBit()) {
            for (var b = 0; b <= 7; b++) {
                expandedBit.push(this.expandBit(b));
            }
        }

        // Expands the 8 bit register operand
        if (!this.hasExpandableRegister()) {
            return expandedBit;
        }
        var expanded8bitRegister: Z80Instruction[] = [];
        expanded8bitRegister.push(
            this.expand8bitRegister('A', 7),
            this.expand8bitRegister('B', 0),
            this.expand8bitRegister('C', 1),
            this.expand8bitRegister('D', 2),
            this.expand8bitRegister('E', 3),
            this.expand8bitRegister('H', 4),
            this.expand8bitRegister('L', 5)
        );
        return expanded8bitRegister;
    }

    /**
     * @returns true if this operation can be expanded
     */
    public isExpandable(): boolean {
        return this.hasExpandableBit() || this.hasExpandableRegister();
    }

    private hasExpandableBit(): boolean {
        return this.opcodes.indexOf("+8*b") != -1;
    }

    private hasExpandableRegister(): boolean {
        return this.opcodes.indexOf("+r") != -1;
    }

    private expandBit(bit: number): Z80Instruction {

        const expandedInstruction = this.instruction.replace(/b/, bit.toString());
        const opcodeBitIndex = this.opcodes.indexOf("+8*b");
        const expandedOpcode = parseInt(this.opcodes.substring(opcodeBitIndex - 2, opcodeBitIndex), 16) + 8 * bit;
        const expandedOpcodes = this.opcodes.substring(0, opcodeBitIndex - 2)
            + formatHexadecimalByte(expandedOpcode)
            + this.opcodes.substring(opcodeBitIndex + 4);

        return new Z80Instruction(
            this.instructionSet,
            expandedInstruction,
            formatTiming(this.z80Timing),
            formatTiming(this.msxTiming),
            formatTiming(this.cpcTiming),
            expandedOpcodes,
            this.size.toString());
    }

    private expand8bitRegister(register: string, addend: number): Z80Instruction {

        const expandedInstruction = this.instruction.replace(/r/, register);
        const opcodeRegisterIndex = this.opcodes.indexOf("+r");
        const expandedOpcode = parseInt(this.opcodes.substring(opcodeRegisterIndex - 2, opcodeRegisterIndex), 16) + addend;
        const expandedOpcodes = this.opcodes.substring(0, opcodeRegisterIndex - 2)
            + formatHexadecimalByte(expandedOpcode)
            + this.opcodes.substring(opcodeRegisterIndex + 4);

        return new Z80Instruction(
            this.instructionSet,
            expandedInstruction,
            formatTiming(this.z80Timing),
            formatTiming(this.msxTiming),
            formatTiming(this.cpcTiming),
            expandedOpcodes,
            this.size.toString());
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
                if ((candidateNumber !== undefined)
                        && (candidateNumber === NumericExpressionParser.parse(expectedOperand))) {
                    return 1; // (exact match)
                }
            // falls-through
            default:
                // (due possibility of using constants, labels, and expressions in the source code,
                // there is no proper way to discriminate: b, n, nn, o, 0, 1, 2, 8H, 10H, 18H, 20H, 28H, 30H, 38H;
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
