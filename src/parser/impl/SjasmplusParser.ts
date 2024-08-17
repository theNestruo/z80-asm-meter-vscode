import * as vscode from 'vscode';
import { config } from "../../config";
import { sjasmplusFakeInstructionSet } from "../../data/SjasmplusFakeInstructionSet";
import { Meterable } from "../../model/Meterable";
import { MeterableCollection } from "../../model/MeterableCollection";
import { SourceCode } from "../../model/SourceCode";
import { anySymbolOperandScore, extractIndirection, extractMnemonicOf, extractOperandsOf, isIXWithOffsetScore, isIXhScore, isIXlScore, isIYWithOffsetScore, isIYhScore, isIYlScore, isIndirectionOperand, isVerbatimOperand, verbatimOperandScore } from "../../utils/AssemblyUtils";
import { AbstractRepetitionParser, InstructionParser } from "../Parsers";
import { z80InstructionParser } from "./Z80InstructionParser";

/**
 * A sjasmplus fake instruction
 */
class SjasmplusFakeInstruction extends MeterableCollection {

    // Information
    private instructionSet: string;
    private fakeInstruction: string;
    private rawInstructions: string[];

    // Derived information (will be cached for performance reasons)
    private mnemonic: string | undefined;
    private operands: string[] | undefined;
    private ready: boolean = false;

    constructor(
        instructionSet: string, fakeInstruction: string,
        rawInstructions: string[]) {
        super();

        this.instructionSet = instructionSet;
        this.fakeInstruction = fakeInstruction;
        this.rawInstructions = rawInstructions;
    }

    /**
     * @returns The instruction set this instruction belongs to
     */
    getInstructionSet(): string {
        return this.instructionSet;
    }

    /**
     * @returns The normalized sjasmplus fake instruction
     */
    get instruction(): string {
        return this.fakeInstruction;
    }

    /**
     * @returns the mnemonic
     */
    getMnemonic(): string {
        return this.mnemonic
            ? this.mnemonic
            : this.mnemonic = extractMnemonicOf(this.fakeInstruction);
    }

    /**
     * @returns the operands
     */
    getOperands(): string[] {
        return this.operands
            ? this.operands
            : this.operands = extractOperandsOf(this.fakeInstruction);
    }

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
    getZ80Timing(): number[] {
        this.init();
        return super.z80Timing;
    }

    /**
     * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
     */
    getMsxTiming(): number[] {
        this.init();
        return super.msxTiming;
    }

    /**
     * @returns The CPC timing, in NOPS
     */
    getCpcTiming(): number[] {
        this.init();
        return super.cpcTiming;
    }

    /**
     * @returns The bytes
     */
    getBytes(): string[] {
        this.init();
        return super.bytes;
    }

    /**
     * @returns The size in bytes
     */
    get size(): number {
        this.init();
        return super.size;
    }

    private init(): void {

        if (!this.ready) {
            this.rawInstructions.forEach(rawInstruction => {
                const instruction = z80InstructionParser.parseInstruction(rawInstruction);
                this.add(instruction);
            });
            this.ready = true;
        }
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
                return anySymbolOperandScore(candidateOperand);
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

class SjasmplusFakeInstructionParser implements InstructionParser {

    // Instruction maps
    private instructionByMnemonic: Record<string, SjasmplusFakeInstruction[]>;

    // (cached for performance reasons)
    private instructionSets: string[];

    constructor() {

        // Initializes instruction maps
        this.instructionByMnemonic = {};
        sjasmplusFakeInstructionSet.forEach(rawData => {

            // Parses the raw instruction
            const instruction = new SjasmplusFakeInstruction(
                rawData[0], // instructionSet
                rawData[1], // fake instruction
                rawData.slice(2)); // actual instructions

            // Prepares a map by mnemonic for performance reasons
            const mnemonic = instruction.getMnemonic();
            if (!this.instructionByMnemonic[mnemonic]) {
                this.instructionByMnemonic[mnemonic] = [];
            }
            this.instructionByMnemonic[mnemonic].push(instruction);
        });

        this.instructionSets = config.instructionSets;
    }

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        this.instructionSets = config.instructionSets;
    }

    get isEnabled(): boolean {
        return config.syntax.sjasmplusFakeInstructions;
    }

    parse(s: SourceCode): Meterable | undefined {

        // Locates candidate instructions
        const instruction = s.instruction;
        const mnemonic = extractMnemonicOf(instruction);
        const candidates = this.instructionByMnemonic[mnemonic];
        if (candidates) {
            return this.findBestCandidate(instruction, candidates);
        }

        // (unknown mnemonic/instruction)
        return undefined;
    }

    private findBestCandidate(instruction: string, candidates: SjasmplusFakeInstruction[]):
            SjasmplusFakeInstruction | undefined {

        // Locates instruction
        let bestCandidate;
        let bestScore = 0;
        for (const candidate of candidates) {
            if (!this.instructionSets.includes(candidate.getInstructionSet())) {
                // Invalid instruction set
                continue;
            }
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

class SjasmplusRegisterListInstructionParser implements InstructionParser {

    get isEnabled(): boolean {
        return config.syntax.sjasmplusRegisterListInstructions;
    }

    parse(s: SourceCode): Meterable | undefined {

        // Register lists instructions
        const instruction = s.instruction;
        const mnemonic = extractMnemonicOf(instruction);
        if (["PUSH", "POP", "INC", "DEC"].indexOf(mnemonic) === -1) {
            return undefined;
        }

        const collection = new MeterableCollection();
        for (const operand of extractOperandsOf(instruction)) {
            if (operand === "") {
                continue;
            }
            const partialInstruction = `${mnemonic} ${operand}`;

            // Tries to parse Z80 instruction
            const z80Instruction = z80InstructionParser.parseInstruction(partialInstruction);
            if (!z80Instruction) {
                // (unknown mnemonic/instruction)
                return undefined;
            }

            collection.add(z80Instruction);
        }
        return collection;
    }
}

class SjasmplusDupRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("DUP", "EDUP");
    }

    get isEnabled(): boolean {
        return config.syntax.sjasmplusDupEdupRepetition;
    }
}

class SjasmplusReptRepetitionParser extends AbstractRepetitionParser {

    constructor() {
        super("REPT", "ENDR");
    }

    get isEnabled(): boolean {
        return config.syntax.sjasmplusReptEndrRepetition;
    }
}

export const sjasmplusFakeInstructionParser = new SjasmplusFakeInstructionParser();
export const sjasmplusRegisterListInstructionParser = new SjasmplusRegisterListInstructionParser();
export const sjasmplusDupRepetitionParser = new SjasmplusDupRepetitionParser();
export const sjasmplusReptRepetitionParser = new SjasmplusReptRepetitionParser();

