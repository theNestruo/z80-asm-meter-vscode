import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from '../config';
import { repeatedMeterable } from '../model/RepeatedMeterable';
import { Meterable, MeterableCollection, SourceCode } from '../types';
import { InstructionParser, RepetitionParser, TimingHintsParser } from './Parsers';
import { assemblyDirectiveParser } from './impl/AssemblyDirectiveParser';
import { glassFakeInstructionParser, glassReptRepetitionParser } from './impl/GlassParser';
import { macroParser } from './impl/MacroParser';
import { sjasmplusDupRepetitionParser, sjasmplusFakeInstructionParser, sjasmplusRegisterListInstructionParser, sjasmplusReptRepetitionParser } from './impl/SjasmplusParser';
import { z80InstructionParser } from './impl/Z80InstructionParser';
import { defaultTimingHintsParser } from './timingHints/DefaultTimingHintsParser';
import { regExpTimingHintsParser } from './timingHints/RegExpTimingHintsParser';
import { timingHintedMeterable } from './timingHints/TimingHintedMeterable';
import { TimingHints } from './timingHints/TimingHints';

class MainParser {

    private readonly disposable: vscode.Disposable;

    // Available parsers for this instance
    private readonly instructionParsers: InstructionParser[];
    private readonly repetitionParsers: RepetitionParser[];
    private readonly timingHintsParsers: TimingHintsParser[];

    // Enabled parsers for this instance (for performance reasons)
    private enabledInstructionParsers: InstructionParser[] = [];
    private enabledRepetitionParsers: RepetitionParser[] = [];
    private enabledTimingHintsParsers: TimingHintsParser[] = [];

    private instructionsCache;

    constructor(
        instructionParsers: InstructionParser[],
        repetitionParsers: RepetitionParser[],
        timingHintsParsers: TimingHintsParser[]) {

        this.instructionParsers = instructionParsers;
        this.repetitionParsers = repetitionParsers;
        this.timingHintsParsers = timingHintsParsers;

		// Subscribe to configuration change event
		this.disposable = vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

        // Initializes parsers and cache
        this.initializeParsers();
		this.instructionsCache = HLRU(config.parser.instructionsCacheSize);
    }

	dispose() {
        this.disposable.dispose();
	}

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        // Re-initializes parsers and cache
        this.initializeParsers();
		this.instructionsCache = HLRU(config.parser.instructionsCacheSize);
    }

    private initializeParsers() {

        // Enables/disables parsers for this instance (for performance reasons)
        this.enabledInstructionParsers = this.instructionParsers
            .filter(instructionParser => instructionParser.isEnabled);
        this.enabledRepetitionParsers = this.repetitionParsers
            .filter(repetitionParser => repetitionParser.isEnabled);
        this.enabledTimingHintsParsers = this.timingHintsParsers
            .filter(timingHintsParser => timingHintsParser.isEnabled);
    }

    parse(sourceCodes: SourceCode[]): MeterableCollection | undefined {

        // (sanity checks)
        if (!sourceCodes.length) {
            return undefined;
        }

        // Actual parsing
        const ret = new MeterableCollection();
        let meterables = ret;
        let repetitions = 1;
        let isEmpty = true;

        const meterablesStack: MeterableCollection[] = [];
        const repetitionsStack: number[] = [];

        // Parses the source code parts
        sourceCodes.forEach(sourceCode => {

            // Handles repetition start
            const newRepetitions = this.parseRepetition(sourceCode.instruction);
            if (newRepetitions !== undefined) {
                const previousMeterables = meterables;
                meterablesStack.push(meterables);
                meterables = new MeterableCollection();
                previousMeterables.add(repeatedMeterable(meterables, newRepetitions));
                repetitionsStack.push(repetitions);
                repetitions *= newRepetitions;
                return;
            }

            // Handles repetition end
            if (this.parseRepetitionEnd(sourceCode.instruction)) {
                meterables = meterablesStack.pop() ?? ret;
                repetitions = repetitionsStack.pop() ?? 1;
                return;
            }

            // Parses the actual meterable and optional timing hints
            let meterable = this.parseInstruction(sourceCode);
            const timingHints = this.parseTimingHints(sourceCode);
            if (timingHints) {
                meterable = timingHintedMeterable(meterable, timingHints, sourceCode);
            }
            if (!meterable) {
                return;
            }

            meterables.add(repeatedMeterable(meterable, sourceCode.repetitions));
            isEmpty = false;
        });

        return isEmpty ? undefined : ret;
    }

    private parseRepetition(s: string): number | undefined {

        // Tries to parse as a repetition instruction
        for (const repetitionParser of this.enabledRepetitionParsers) {
            const count = repetitionParser.parse(s);
            if (count !== undefined) {
                return count;
            }
        }

        // (not a repetition instruction)
        return undefined;
    }

    private parseRepetitionEnd(s: string): boolean {

        // Tries to parse as a repetition end instruction
        for (const repetitionParser of this.enabledRepetitionParsers) {
            if (repetitionParser.parseEnd(s)) {
                return true;
            }
        }

        // (not a repetition end instruction)
        return false;
    }

    parseInstruction(s: SourceCode): Meterable | undefined {

        const cachedMeterable = this.instructionsCache.get(s.instruction);

        // Uses the cached value
        if (cachedMeterable) {
			return cachedMeterable;
		}

        // Tries to parse as an instruction
        for (const parser of this.enabledInstructionParsers) {
            const instruction = parser.parse(s);
            if (instruction) {
                // Caches value
                this.instructionsCache.set(s.instruction, instruction);
                return instruction;
            }
        }

        // (not an instruction)
        return undefined;
    }

    private parseTimingHints(s: SourceCode): TimingHints | undefined {

        // Tries to parse timing hints
        for (const parser of this.enabledTimingHintsParsers) {
            const timingHints = parser.parse(s);
            if (timingHints) {
                return timingHints;
            }
        }

        // (no timing hints)
        return undefined;
    }
}

const allInstructionParsers = [
    sjasmplusFakeInstructionParser,
    sjasmplusRegisterListInstructionParser,
    glassFakeInstructionParser,
    z80InstructionParser, // (after SjASMPlus and Glass Z80 assembler parsers)
    macroParser,
    assemblyDirectiveParser
];

const allInstructionParsersButMacro = [
    sjasmplusFakeInstructionParser,
    sjasmplusRegisterListInstructionParser,
    glassFakeInstructionParser,
    z80InstructionParser, // (after SjASMPlus and Glass Z80 assembler parsers)
    assemblyDirectiveParser
];

const allRepetitionParsers = [
    sjasmplusDupRepetitionParser,
    sjasmplusReptRepetitionParser,
    glassReptRepetitionParser
];

const allTimingHintsParsers = [
    defaultTimingHintsParser,
    regExpTimingHintsParser
];

export const mainParser = new MainParser(
    allInstructionParsers, allRepetitionParsers, allTimingHintsParsers);

export const mainParserWithoutMacro = new MainParser(
    allInstructionParsersButMacro, allRepetitionParsers, allTimingHintsParsers);

export const mainParserWithoutTimingHints = new MainParser(
    allInstructionParsers, allRepetitionParsers, []);
