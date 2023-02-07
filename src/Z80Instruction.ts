import { Meterable } from './Meterable';
import { NumericExpressionParser } from './NumericExpressionParser';
import { extractIndirection, extractMnemonicOf, extractOperandsOf, formatHexadecimalByte, formatTiming, is8bitRegisterReplacingHLByIX8bitScore, is8bitRegisterReplacingHLByIY8bitScore, is8bitRegisterScore, isAnyRegister, isIndirectionOperand, isIXhScore, isIXlScore, isIXWithOffsetScore, isIYhScore, isIYlScore, isIYWithOffsetScore, isVerbatimOperand, parseTimings, sdccIndexRegisterIndirectionScore, verbatimOperandScore } from './utils';

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

        const expandableIndex = this.opcodes.indexOf("+");
        if (expandableIndex == -1) {
            // Not expandable
            return [this];
        }

        const expandableExpression = this.opcodes.substring(expandableIndex);

        // Expands bit
        if (expandableExpression.substring(0, 4) === "+8*b") {
            const bitExpanded: Z80Instruction[] = [
                    this.expandWithFactorUsing(this, /b/, "0", "+8*b", 8, 0),
                    this.expandWithFactorUsing(this, /b/, "1", "+8*b", 8, 1),
                    this.expandWithFactorUsing(this, /b/, "2", "+8*b", 8, 2),
                    this.expandWithFactorUsing(this, /b/, "3", "+8*b", 8, 3),
                    this.expandWithFactorUsing(this, /b/, "4", "+8*b", 8, 4),
                    this.expandWithFactorUsing(this, /b/, "5", "+8*b", 8, 5),
                    this.expandWithFactorUsing(this, /b/, "6", "+8*b", 8, 6),
                    this.expandWithFactorUsing(this, /b/, "7", "+8*b", 8, 7) ];
            if (expandableExpression.substring(0, 6) !== "+8*b+r") {
                return [
                        this, // (keeps unexpanded bit instruction)
                        ...bitExpanded ];
            }

            // Expands bit *and* 8 bit register
            const ret: Z80Instruction[] = [];
            bitExpanded.forEach(base => {
                ret.push(
                        this.expandUsing(base, /r/, "A", "+r", 7),
                        this.expandUsing(base, /r/, "B", "+r", 0),
                        this.expandUsing(base, /r/, "C", "+r", 1),
                        this.expandUsing(base, /r/, "D", "+r", 2),
                        this.expandUsing(base, /r/, "E", "+r", 3),
                        this.expandUsing(base, /r/, "H", "+r", 4),
                        this.expandUsing(base, /r/, "L", "+r", 5) );
            });
            // (keeps unexpanded bit instructions)
            ret.push(
                this.expandWithInfixUsing(this, /r/, "A", "+8*b+r", 1, 7, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "B", "+8*b+r", 1, 0, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "C", "+8*b+r", 1, 1, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "D", "+8*b+r", 1, 2, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "E", "+8*b+r", 1, 3, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "H", "+8*b+r", 1, 4, "+8*b"),
                this.expandWithInfixUsing(this, /r/, "L", "+8*b+r", 1, 5, "+8*b")
            );
            return ret;
        }

        // Expands high/low part of the IX register
        if (this.instruction.indexOf("IXp") !== -1) {
            return (expandableExpression.substring(0, 4) === "+8*p")
                    ? [ this.expandWithFactorUsing(this, /IXp/, "IXh", "+8*p", 8, 4),
                        this.expandWithFactorUsing(this, /IXp/, "IXl", "+8*p", 8, 5) ]
                    : [ this.expandUsing(this, /IXp/, "IXh", "+p", 4),
                        this.expandUsing(this, /IXp/, "IXl", "+p", 5) ];
        }

        // Expands high/low part of the IY register
        if (this.instruction.indexOf("IYq") !== -1) {
            return (expandableExpression.substring(0, 4) === "+8*q")
                    ? [ this.expandWithFactorUsing(this, /IYq/, "IYh", "+8*q", 8, 4),
                        this.expandWithFactorUsing(this, /IYq/, "IYl", "+8*q", 8, 5) ]
                    : [ this.expandUsing(this, /IYq/, "IYh", "+q", 4),
                        this.expandUsing(this, /IYq/, "IYl", "+q", 5) ];
        }

        // Expands 8 bit register where H/L have been replaced by IXh/IXl
        if (expandableExpression.substring(0, 2) === "+p") {
            return [
                    this.expandUsing(this, /p/, "A", "+p", 7),
                    this.expandUsing(this, /p/, "B", "+p", 0),
                    this.expandUsing(this, /p/, "C", "+p", 1),
                    this.expandUsing(this, /p/, "D", "+p", 2),
                    this.expandUsing(this, /p/, "E", "+p", 3),
                    this.expandUsing(this, /p/, "IXh", "+p", 4),
                    this.expandUsing(this, /p/, "IXl", "+p", 5) ];
        }

        // Expands 8 bit register where H/L have been replaced by IYh/IYl
        if (expandableExpression.substring(0, 2) === "+q") {
            return [
                    this.expandUsing(this, /q/, "A", "+q", 7),
                    this.expandUsing(this, /q/, "B", "+q", 0),
                    this.expandUsing(this, /q/, "C", "+q", 1),
                    this.expandUsing(this, /q/, "D", "+q", 2),
                    this.expandUsing(this, /q/, "E", "+q", 3),
                    this.expandUsing(this, /q/, "IYh", "+q", 4),
                    this.expandUsing(this, /q/, "IYl", "+q", 5) ];
        }

        // Expands 8 bit register
        if (expandableExpression.substring(0, 2) === "+r") {
            return [
                    this.expandUsing(this, /r/, "A", "+r", 7),
                    this.expandUsing(this, /r/, "B", "+r", 0),
                    this.expandUsing(this, /r/, "C", "+r", 1),
                    this.expandUsing(this, /r/, "D", "+r", 2),
                    this.expandUsing(this, /r/, "E", "+r", 3),
                    this.expandUsing(this, /r/, "H", "+r", 4),
                    this.expandUsing(this, /r/, "L", "+r", 5) ];
        }

        // (should never happen)
        return [this];
    }

    private expandUsing(base: Z80Instruction,
            searchInstruction: RegExp, replacementInstruction: string,
            searchOpcodes: string, addend: number): Z80Instruction {

        return this.expandWithFactorUsing(base,
                searchInstruction, replacementInstruction,
                searchOpcodes, 1, addend);
    }

    private expandWithFactorUsing(base: Z80Instruction,
            searchInstruction: RegExp, replacementInstruction: string,
            searchOpcodes: string, factor: number, addend: number): Z80Instruction {

        return this.expandWithInfixUsing(base,
                searchInstruction, replacementInstruction,
                searchOpcodes, factor, addend, "");
    }

    private expandWithInfixUsing(base: Z80Instruction,
            searchInstruction: RegExp, replacementInstruction: string,
            searchOpcodes: string, factor: number, addend: number, infix: string): Z80Instruction {

        const expandedInstruction = base.instruction.replace(searchInstruction, replacementInstruction);
        const index = base.opcodes.indexOf(searchOpcodes);
        const prefix = base.opcodes.substring(0, index - 2);
        const baseValue = parseInt(base.opcodes.substring(index - 2, index), 16);
        const suffix = base.opcodes.substring(index + searchOpcodes.length);
        const expandedOpcodes = prefix + formatHexadecimalByte(baseValue + factor * addend) + infix + suffix;

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
            case "IYh":
                return isIYhScore(candidateOperand);
            case "IYl":
                return isIYlScore(candidateOperand);
            case "p":
                return is8bitRegisterReplacingHLByIX8bitScore(candidateOperand);
            case "q":
                return is8bitRegisterReplacingHLByIY8bitScore(candidateOperand);
            case "0":   // BIT/RES/SET, IM 0, RST 0, and OUT (C), 0
            case "1":   // BIT/RES/SET, IM 1
            case "2":   // BIT/RES/SET, IM 2
            case "3":   // BIT/RES/SET
            case "4":   // BIT/RES/SET
            case "5":   // BIT/RES/SET
            case "6":   // BIT/RES/SET
            case "7":   // BIT/RES/SET
            case "8H":  // RST 8H
            case "10H": // RST 10H
            case "18H": // RST 18H
            case "20H": // RST 20H
            case "28H": // RST 28H
            case "30H": // RST 30H
            case "38H": // RST 38H
                return this.numericOperandScore(expectedOperand, candidateOperand);
            default:
                return this.anySymbolOperandScore(candidateOperand);
        }
    }

    private indirectOperandScore(expectedOperand: string, candidateOperand: string): number {

        // Compares the expression inside the indirection
        return isIndirectionOperand(candidateOperand, false)
            ? this.operandScore(extractIndirection(expectedOperand), extractIndirection(candidateOperand), false)
            : 0;
    }

    private numericOperandScore(expectedOperand: string, candidateOperand: string): number {

        // Compares as numeric expressions
        const candidateNumber = NumericExpressionParser.parse(candidateOperand);
        if (candidateNumber !== undefined) {
            return (candidateNumber === NumericExpressionParser.parse(expectedOperand))
                ? 1 // (exact match)
                : 0; // (discards match; will default to unexpanded instruction if exists)
        }

        // (due possibility of using constants, labels, and expressions in the source code,
        // uses a "best effort" to discard registers and indirections)
        return isAnyRegister(
            isIndirectionOperand(candidateOperand, false)
                ? extractIndirection(candidateOperand)
                : candidateOperand)
            ? 0
            : 0.25;
    }

    private anySymbolOperandScore(candidateOperand: string): number {

        // (due possibility of using constants, labels, and expressions in the source code,
        // there is no proper way to discriminate: b, n, nn, o;
        // but uses a "best effort" to discard registers)
        return isAnyRegister(
            isIndirectionOperand(candidateOperand, false)
                ? extractIndirection(candidateOperand)
                : candidateOperand)
            ? 0
            : 0.75;
    }
}
