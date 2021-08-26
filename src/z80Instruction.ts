import { Z80AbstractInstruction } from './z80AbstractInstruction';
import { extractMnemonicOf, extractOperandsOf, formatHexadecimalByte, formatTiming, parseTimings } from './z80Utils';

export class Z80Instruction extends Z80AbstractInstruction {

    // Information
    private instructionSet: string;
    private instruction: string;
    private z80Timing: number[];
    private msxTiming: number[];
    private cpcTiming: number[];
    private opcode: string;
    private size: number;

    // Derived information (will be cached for performance reasons)
    private mnemonic: string | undefined;
    private operands: string[] | undefined;
    private implicitAccumulatorSyntaxAllowed: boolean | undefined;
    private explicitAccumulatorSyntaxAllowed: boolean | undefined;

    constructor(
            instructionSet: string, instruction: string,
            z80Timing: string, msxTiming: string, cpcTiming: string,
            opcode: string, size: string) {
        super();

        this.instructionSet = instructionSet;
        this.instruction = instruction;
        this.z80Timing = parseTimings(z80Timing);
        this.msxTiming = parseTimings(msxTiming);
        this.cpcTiming = parseTimings(cpcTiming);
        this.opcode = opcode;
        this.size = parseInt(size);

        this.mnemonic = undefined;
        this.operands = undefined;
        this.implicitAccumulatorSyntaxAllowed = undefined;
        this.explicitAccumulatorSyntaxAllowed = undefined;
    }

    /**
     * @returns The instruction set
     */
    public getInstructionSet(): string {
        return this.instructionSet;
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
     * @returns The bytes of the instruction
     */
    public getBytes(): string {
        return this.getOpcode();
    }

    /**
     * @returns The opcode of the instruction
     */
     public getOpcode(): string {
        return this.opcode;
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
     * @returns true if this operation can be expanded
     */
    public isExpandable(): boolean {

        // (for the moment, we only need to expand single byte operations with an 8 bit register operand)
        return this.size === 1
                && !!this.opcode.match(/^[0-9A-F]{2}\+r$/);
    }

    /**
     * @returns an array of Z80Instruction, expanded from the actual instruction
     */
    public expand(): Z80Instruction[] {

        if (!this.isExpandable()) {
            return [this];
        }

        // Expands the 8 bit register operand
        return [
                this.expand8bitRegister('A', 7),
                this.expand8bitRegister('B', 0),
                this.expand8bitRegister('C', 1),
                this.expand8bitRegister('D', 2),
                this.expand8bitRegister('E', 3),
                this.expand8bitRegister('H', 4),
                this.expand8bitRegister('L', 5)
            ];
    }

    private expand8bitRegister(register: string, addend: number): Z80Instruction {

        const expandedInstruction = this.instruction.replace(/r/, register);
        const expandedOpcode = parseInt(this.opcode.substring(0, 2), 16) + addend;

        return new Z80Instruction(
                this.instructionSet,
                expandedInstruction,
                formatTiming(this.z80Timing),
                formatTiming(this.msxTiming),
                formatTiming(this.cpcTiming),
                formatHexadecimalByte(expandedOpcode),
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
        if (this.isVerbatimOperand(expectedOperand)) {
            return this.verbatimOperandScore(expectedOperand, candidateOperand);
        }

        // Must the candidate operand be an indirection?
        if (indirectionAllowed && this.isIndirectionOperand(expectedOperand, true)) {
            // Checks for SDCC index register syntax
            const sdccIndexRegisterIndirectionScore = this.sdccIndexRegisterIndirectionScore(expectedOperand, candidateOperand);
            if (sdccIndexRegisterIndirectionScore !== undefined) {
                return sdccIndexRegisterIndirectionScore;
            }
            return this.indirectOperandScore(expectedOperand, candidateOperand);
        }

        // Depending on the expected operand...
        switch (expectedOperand) {
        case "r":
            return this.is8bitRegisterScore(candidateOperand);
        case "IX+o":
            return this.isIXWithOffsetScore(candidateOperand);
        case "IY+o":
            return this.isIYWithOffsetScore(candidateOperand);
        case "IXh":
            return this.isIXhScore(candidateOperand);
        case "IXl":
            return this.isIXlScore(candidateOperand);
        case "IXp":
            return this.isIX8bitScore(candidateOperand);
        case "IYh":
            return this.isIYhScore(candidateOperand);
        case "IYl":
            return this.isIYlScore(candidateOperand);
        case "IYq":
            return this.isIY8bitScore(candidateOperand);
        case "p":
            return this.is8bitRegisterReplacingHLByIX8bitScore(candidateOperand);
        case "q":
            return this.is8bitRegisterReplacingHLByIY8bitScore(candidateOperand);
        case "0": // IM 0, RST 0, and OUT (C), 0
        case "1": // IM 1
        case "2": // IM 2
            if (candidateOperand === expectedOperand) {
                return 1; // (exact match for better OUT (C),0 detection)
            }
            // falls-through
        default:
            // (due possibility of using constants, labels, and expressions in the source code,
            // there is no proper way to discriminate: b, n, nn, o, 0, 8H, 10H, 20H, 28H, 30H, 38H;
            // but uses a "best effort" to discard registers)
            return this.isAnyRegister(
                    this.isIndirectionOperand(candidateOperand, false)
                        ? this.extractIndirection(candidateOperand)
                        : candidateOperand)
                    ? 0
                    : 0.75;
        }
    }

    /**
     * @param operand the operand of the instruction
     * @returns true if the candidate operand must match verbatim the operand of the instruction
     */
    private isVerbatimOperand(operand: string): boolean {
        return !!operand.match(/^(A|AF'?|BC?|N?C|DE?|E|HL?|L|I|I[XY]|R|SP|N?Z|M|P[OE]?)$/);
    }

    /**
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @returns 1 if the candidate operand is a perfect match,
     * 0 if the candidate operand is not valid
     */
    private verbatimOperandScore(expectedOperand: string, candidateOperand: string): number {

        return (candidateOperand === expectedOperand) ? 1 : 0;
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
     * @param expectedOperand the operand of the instruction
     * @param candidateOperand the operand from the cleaned-up line
     * @returns number between 0 and 1 with the score of the match,
     * or undefined if SDCC index register indirection syntax is not allowed or not found
     */
    private sdccIndexRegisterIndirectionScore(expectedOperand: string, candidateOperand: string): number | undefined {

        // Depending on the expected indirection...
        switch (this.extractIndirection(expectedOperand)) {
            case "IX+o":
                return candidateOperand.match(/(\(\s*IX\s*\)|\[\s*IX\s*\])$/) ? 1 : undefined;
            case "IY+o":
                return candidateOperand.match(/(\(\s*IY\s*\)|\[\s*IY\s*\])$/) ? 1 : undefined;
            default:
                return undefined;
        }
    }

    /**
     * @param operand the operand of the instruction or the candidate operand
     * @returns the expression inside the indirection
     */
    private extractIndirection(operand: string): string {
        return operand.substring(1, operand.length - 1).trim();
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
        return operand.match(/^IX(\W|$)/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the IY index register with an optional offset, 0 otherwise
     */
    private isIYWithOffsetScore(operand: string): number {
        return operand.match(/^IY(\W|$)/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the high part of the IX index register, 0 otherwise
     */
    private isIXhScore(operand: string): number {
        return operand.match(/^(IX[HU]|XH|HX)$/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the low part of the IX index register, 0 otherwise
     */
    private isIXlScore(operand: string): number {
        return operand.match(/^(IXL|XL|LX)$/) ? 1 : 0;
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
     * @returns 1 if the operand is the high part of the IY index register, 0 otherwise
     */
    private isIYhScore(operand: string): number {
        return operand.match(/^(IY[HU]|YH|HY)$/) ? 1 : 0;
    }

    /**
     * @param operand the candidate operand
     * @returns 1 if the operand is the low part of the IY index register, 0 otherwise
     */
    private isIYlScore(operand: string): number {
        return operand.match(/^(IYL|YL|LY)$/) ? 1 : 0;
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

    /**
     * @param operand the candidate operand
     * @returns true if the operand is any 8 or 16 bit register,
     * including the IX and IY index registers with an optional offset,
     * false otherwise
     */
    private isAnyRegister(operand: string): boolean {
        return !!operand.match(/(^(A|AF'?|BC?|C|DE?|E|HL?|L|I|I[XY][UHL]?|R|SP)$)|(^I[XY]\W)/);
    }
}
