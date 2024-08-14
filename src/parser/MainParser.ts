import * as vscode from 'vscode';
import { config } from '../config';
import { Meterable } from '../model/Meterable';
import { MeterableCollection } from '../model/MeterableCollection';
import { repeatedMeterable } from '../model/RepeatedMeterable';
import { SourceCode } from '../model/SourceCode';
import { timingHintedMeterable } from '../model/TimingHintedMeterable';
import { TimingHints } from '../model/TimingHints';
import { extractSourceCode } from '../utils/SourceCodeUtils';
import { InstructionParser, RepetitionParser, TimingHintsParser } from './Parsers';
import { assemblyDirectiveParser } from './impl/AssemblyDirectiveParser';
import { defaultTimingHintsParser } from './impl/DefaultTimingHintsParser';
import { glassFakeInstructionParser, glassReptRepetitionParser } from './impl/GlassParser';
import { macroParser } from './impl/MacroParser';
import { regExpTimingHintsParser } from './impl/RegExpTimingHintsParser';
import { sjasmplusDupRepetitionParser, sjasmplusFakeInstructionParser, sjasmplusRegisterListInstructionParser, sjasmplusReptRepetitionParser } from './impl/SjasmplusParser';
import { z80InstructionParser } from './impl/Z80InstructionParser';
import QuickLRU from 'quick-lru';

// (precompiled RegExp for performance reasons)
const lineSeparatorRegexp = /[\r\n]+/;

class MainParser {

    // Available parsers for this instance
    private readonly instructionParsers: InstructionParser[];
    private readonly repetitionParsers: RepetitionParser[];
    private readonly timingHintsParsers: TimingHintsParser[];

    // Enabled parsers for this instance
    private enabledInstructionParsers: InstructionParser[] = [];
    private enabledRepetitionParsers: RepetitionParser[] = [];
    private enabledTimingHintsParsers: TimingHintsParser[] = [];

    private readonly instructionsCache = new QuickLRU<string, Meterable>({
		maxSize: 100
	});

    constructor(
        instructionParsers: InstructionParser[],
        repetitionParsers: RepetitionParser[],
        timingHintsParsers: TimingHintsParser[]) {

        this.instructionParsers = instructionParsers;
        this.repetitionParsers = repetitionParsers;
        this.timingHintsParsers = timingHintsParsers;

        this.initializeParsers();
		this.instructionsCache.resize(config.parser.instructionsCacheSize);
    }

    onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

        // Re-initializes parsers
        this.initializeParsers();

        this.instructionsCache.clear();
		this.instructionsCache.resize(config.parser.instructionsCacheSize);
    }

    private initializeParsers() {

        // Enables/disables parsers
        this.enabledInstructionParsers = this.instructionParsers
            .filter(instructionParser => instructionParser.isEnabled);
        this.enabledRepetitionParsers = this.repetitionParsers
            .filter(repetitionParser => repetitionParser.isEnabled);
        this.enabledTimingHintsParsers = this.timingHintsParsers
            .filter(timingHintsParser => timingHintsParser.isEnabled);
    }

    parse(s: string): MeterableCollection | undefined {

        // Extracts actual source code, single line repetitions, and line comments
        const sourceCodes = this.extractSourceCode(s);
        if (!sourceCodes || !sourceCodes.length) {
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
                meterables = meterablesStack.pop() || ret;
                repetitions = repetitionsStack.pop() || 1;
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

    private extractSourceCode(s: string): SourceCode[] | undefined {

        // (sanity checks)
        if (!s) {
            return undefined;
        }
        const rawLines = s.split(lineSeparatorRegexp);
        if (!rawLines.length) {
            return undefined;
        }
        if (rawLines[rawLines.length - 1].trim() === "") {
            // (removes possible spurious empty line at the end of the selection)
            rawLines.pop();
            if (!rawLines.length) {
                return undefined;
            }
        }

        // (avoids querying the configuration for each line)
        const lineSeparatorCharacter = config.syntax.lineSeparatorCharacter;
        const labelRegExp = config.syntax.labelRegExp;
        const repeatRegExp = config.syntax.repeatRegExp;

        // Splits the lines and extracts repetition counter and trailing comments
        const sourceCode: SourceCode[] = [];
        rawLines.forEach(rawLine => {
            sourceCode.push(...extractSourceCode(
                rawLine, lineSeparatorCharacter, labelRegExp, repeatRegExp));
        });
        return (!sourceCode.length) ? undefined : sourceCode;
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

    private parseInstruction(s: SourceCode): Meterable | undefined {

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
    z80InstructionParser,
    sjasmplusFakeInstructionParser,
    sjasmplusRegisterListInstructionParser,
    glassFakeInstructionParser,
    macroParser,
    assemblyDirectiveParser
];

const allButMacroInstructionParsers = [
    z80InstructionParser,
    sjasmplusFakeInstructionParser,
    sjasmplusRegisterListInstructionParser,
    glassFakeInstructionParser,
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

export const noMacroMainParser = new MainParser(
    allButMacroInstructionParsers, allRepetitionParsers, allTimingHintsParsers);

export const noTimingHintsMainParser = new MainParser(
    allInstructionParsers, allRepetitionParsers, []);
