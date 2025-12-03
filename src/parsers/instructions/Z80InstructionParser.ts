import * as vscode from 'vscode';
import { config } from "../../config";
import { z80InstructionSet } from "../../datasets/Z80InstructionSet";
import { InstructionParser } from '../../types/InstructionParser';
import { Meterable } from "../../types/Meterable";
import { SourceCode } from "../../types/SourceCode";
import { anySymbolOperandScore, extractIndirection, extractMnemonicOf, extractOperandsOf, is8bitRegisterReplacingHLByIX8bitScore, is8bitRegisterReplacingHLByIY8bitScore, is8bitRegisterScore, isIXWithOffsetScore, isIXhScore, isIXlScore, isIYWithOffsetScore, isIYhScore, isIYlScore, isIndirectionOperand, isVerbatimOperand, numericOperandScore, sdccIndexRegisterIndirectionScore, verbatimOperandScore } from "../../utils/AssemblyUtils";
import { formatHexadecimalByte, formatTiming } from '../../utils/FormatterUtils';
import { SingletonHolderImpl } from '../../utils/Lifecycle';
import { parseTiming } from "../../utils/ParserUtils";

class Z80InstructionParserHolder extends SingletonHolderImpl<Z80InstructionParser> {

    private readonly _disposable: vscode.Disposable;

    constructor() {
        super();

        this._disposable =
            // Subscribe to configuration change event
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
    }

    onConfigurationChange(event: vscode.ConfigurationChangeEvent) {

        // Forces re-creation on instruction set change
        if (event.affectsConfiguration("z80-asm-meter.platform")) {
            this._instance = undefined;
        }
    }

    override dispose() {
        this._disposable.dispose();
        super.dispose();
    }

    protected override createInstance(): Z80InstructionParser {
        return new Z80InstructionParser(config.instructionSets);
    }
}

export const z80InstructionParser = new Z80InstructionParserHolder();

//

/**
 * Actual implementation of the Z80 instruction parser
 */
class Z80InstructionParser implements InstructionParser {

    // Instruction maps
    private instructionByMnemonic: Record<string, Z80Instruction[]>;
    private instructionByOpcode: Record<string, Z80Instruction>;

    constructor(instructionSets: string[]) {

        // Initializes instruction maps
        this.instructionByMnemonic = {};
        this.instructionByOpcode = {};
        z80InstructionSet.forEach(rawData => {

            // Discard invalid instruction set instructions
            if (!instructionSets.includes(rawData[0])) {
                return;
            }

            // Parses the raw instruction
            const originalInstruction = new Z80Instruction(
                rawData[1], // raw instruction
                rawData[2], // z80Timing
                rawData[3], // msxTiming
                rawData[4], // cpcTiming
                rawData[5], // opcode
                rawData[6]); // size

            originalInstruction.expanded().forEach(instruction => {
                // Prepares a map by mnemonic for performance reasons
                const mnemonic = instruction.getMnemonic();
                if (!this.instructionByMnemonic[mnemonic]) {
                    this.instructionByMnemonic[mnemonic] = [];
                }
                this.instructionByMnemonic[mnemonic].push(instruction);

                // Prepares a map by opcode for single byte instructions
                if (instruction.size === 1) {
                    const opcode = instruction.bytes[0];
                    this.instructionByOpcode[opcode] = instruction;
                }
            });
        });
    }

    parse(s: SourceCode): Meterable | undefined {

        return this.parseInstruction(s.instruction);
    }

    parseInstruction(instruction: string): Meterable | undefined {

        // Locates candidate instructions
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            return this.findBestCandidate(instruction, candidates);
        }

        // (unknown mnemonic/instruction)
        return undefined;
    }

    parseOpcode(opcode: number): Z80Instruction | undefined {

        return this.instructionByOpcode[formatHexadecimalByte(opcode)];
    }

    private findBestCandidate(instruction: string, candidates: Z80Instruction[]):
            Z80Instruction | undefined {

        // Locates instruction
        let bestCandidate;
        let bestScore = 0;
        for (const candidate of candidates) {
            const score = candidate.match(instruction);
            if (score === 1) {
                // Exact match
                return candidate;
            }
            if (score > bestScore) {
                bestCandidate = candidate;
                bestScore = score;
            }
        }
        return (bestCandidate && (bestScore !== 0)) ? bestCandidate : undefined;
    }
}

/**
 * A Z80 instruction
 */
class Z80Instruction implements Meterable {

    // Information
    readonly z80Timing: number[];
    readonly msxTiming: number[];
    readonly cpcTiming: number[];
    readonly size: number;

    // Derived information (will be cached for performance reasons)
    private mnemonic?: string;
    private operands?: string[];
    private implicitAccumulatorSyntaxAllowed?: boolean;
    private explicitAccumulatorSyntaxAllowed?: boolean;

    constructor(
        readonly instruction: string,
        z80Timing: string,
        msxTiming: string,
        cpcTiming: string,
        private readonly opcodes: string,
        size: string) {

        this.instruction = instruction;
        this.z80Timing = parseTiming(z80Timing);
        this.msxTiming = parseTiming(msxTiming);
        this.cpcTiming = parseTiming(cpcTiming);
        this.size = parseInt(size, 10);
    }

    get bytes(): string[] {
        return [this.opcodes];
    }

    flatten(): Meterable[] {
        return [this];
    }

    readonly isComposed = false;

    /**
     * @returns the mnemonic
     */
    getMnemonic(): string {
        return this.mnemonic ??= extractMnemonicOf(this.instruction);
    }

    /**
     * @returns the operands
     */
    getOperands(): string[] {
        return this.operands ??= extractOperandsOf(this.instruction);
    }

    /**
     * @returns an array of Z80Instruction, expanded from the actual instruction
     */
    expanded(): Z80Instruction[] {

        const expandableIndex = this.opcodes.indexOf("+");
        if (expandableIndex === -1) {
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
                this.expandWithFactorUsing(this, /b/, "7", "+8*b", 8, 7)];
            if (expandableExpression.substring(0, 6) !== "+8*b+r") {
                return [
                    this, // (keeps unexpanded bit instruction)
                    ...bitExpanded];
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
                    this.expandUsing(base, /r/, "L", "+r", 5));
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
        if (this.instruction.includes("IXp")) {
            return (expandableExpression.substring(0, 4) === "+8*p")
                ? [this.expandWithFactorUsing(this, /IXp/, "IXh", "+8*p", 8, 4),
                this.expandWithFactorUsing(this, /IXp/, "IXl", "+8*p", 8, 5)]
                : [this.expandUsing(this, /IXp/, "IXh", "+p", 4),
                this.expandUsing(this, /IXp/, "IXl", "+p", 5)];
        }

        // Expands high/low part of the IY register
        if (this.instruction.includes("IYq")) {
            return (expandableExpression.substring(0, 4) === "+8*q")
                ? [this.expandWithFactorUsing(this, /IYq/, "IYh", "+8*q", 8, 4),
                this.expandWithFactorUsing(this, /IYq/, "IYl", "+8*q", 8, 5)]
                : [this.expandUsing(this, /IYq/, "IYh", "+q", 4),
                this.expandUsing(this, /IYq/, "IYl", "+q", 5)];
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
                this.expandUsing(this, /p/, "IXl", "+p", 5)];
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
                this.expandUsing(this, /q/, "IYl", "+q", 5)];
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
                this.expandUsing(this, /r/, "L", "+r", 5)];
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
     * and there is one single operand)
     */
    private isExplicitAccumulatorSyntaxAllowed(): boolean {

        if (this.explicitAccumulatorSyntaxAllowed !== undefined) {
            return this.explicitAccumulatorSyntaxAllowed;
        }

        const explicitAccumulatorSyntaxMnemonics = [
            "ADC", "ADD", "AND", "CP", "DEC", "INC", "OR", "RL", "RLC", "RR",
            "RRC", "SBC", "SLA", "SRA", "SRL", "SUB", "XOR"
        ];
        if (!explicitAccumulatorSyntaxMnemonics.includes(this.getMnemonic())) {
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
    match(candidateInstruction: string): number {

        // Compares mnemonic
        if (extractMnemonicOf(candidateInstruction) !== this.mnemonic) {
            return 0;
        }

        // Extracts the candidate operands
        const candidateOperands = extractOperandsOf(candidateInstruction);
        if (candidateOperands.includes("")) {
            return 0; // (incomplete candidate instruction, such as "LD A,")
        }

        const candidateOperandsLength = candidateOperands.length;
        const expectedOperands = this.getOperands();
        const expectedOperandsLength = expectedOperands.length;

        // Compares operand count
        let implicitAccumulatorSyntax = false;
        let explicitAccumulatorSyntax = false;
        if (candidateOperandsLength !== expectedOperandsLength) {

            if (candidateOperands.length === expectedOperands.length - 1) {
                // Checks implicit accumulator syntax
                implicitAccumulatorSyntax = this.isImplicitAccumulatorSyntaxAllowed();
                if (!implicitAccumulatorSyntax) {
                    return 0;
                }

            } else if (candidateOperands.length === expectedOperands.length + 1) {
                // Checks explicit accumulator syntax
                explicitAccumulatorSyntax = this.isExplicitAccumulatorSyntaxAllowed();
                if (!explicitAccumulatorSyntax || (candidateOperands[0] !== "A")) {
                    return 0;
                }

            } else {
                // Operand count mismatch
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
            // (checks for SDCC index register syntax first)
            return sdccIndexRegisterIndirectionScore(expectedOperand, candidateOperand)
                ?? this.indirectOperandScore(expectedOperand, candidateOperand);
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
                return numericOperandScore(expectedOperand, candidateOperand);
            // (due possibility of using constants, labels, and expressions in the source code,
            // there is no proper way to discriminate: b, n, nn, o;
            // but uses a "best effort" to discard registers)
            default:
                return anySymbolOperandScore(candidateOperand, true);
        }
    }

    private indirectOperandScore(expectedOperand: string, candidateOperand: string): number {

        // Compares the expression inside the indirection
        return isIndirectionOperand(candidateOperand, false)
            ? this.operandScore(extractIndirection(expectedOperand), extractIndirection(candidateOperand), false)
            : 0;
    }
}
