import * as vscode from 'vscode';
import { config } from '../config';
import { Meterable } from '../model/Meterable';
import { MeterableCollection } from '../model/MeterableCollection';
import { RepeatedMeterable } from '../model/RepeatedMeterable';
import { SourceCode, extractSourceCode } from '../model/SourceCode';
import { TimingHintedMeterable } from '../model/TimingHintedMeterable';
import { TimingHints } from '../model/TimingHints';
import { InstructionParser, RepetitionParser, TimingHintsParser } from './Parsers';
import { AssemblyDirectiveParser } from './impl/AssemblyDirectiveParser';
import { DefaultTimingHintsParser } from './impl/DefaultTimingHintsParser';
import { GlassFakeInstructionParser, GlassReptRepetitionParser } from './impl/GlassParser';
import { MacroParser } from './impl/MacroParser';
import { SjasmplusDupRepetitionParser, SjasmplusFakeInstructionParser, SjasmplusRegisterListInstructionParser, SjasmplusReptRepetitionParser } from './impl/SjasmplusParser';
import { Z80InstructionParser } from './impl/Z80InstructionParser';

export class MainParser {

    private static readonly allInstructionParsers = [
        Z80InstructionParser.instance,
        SjasmplusFakeInstructionParser.instance,
        SjasmplusRegisterListInstructionParser.instance,
        GlassFakeInstructionParser.instance,
        MacroParser.instance,
        AssemblyDirectiveParser.instance
    ];

    private static readonly noMacroInstructionParsers = [
        Z80InstructionParser.instance,
        SjasmplusFakeInstructionParser.instance,
        SjasmplusRegisterListInstructionParser.instance,
        GlassFakeInstructionParser.instance,
        AssemblyDirectiveParser.instance
    ];

    private static readonly allRepetitionParsers = [
        SjasmplusDupRepetitionParser.instance,
        SjasmplusReptRepetitionParser.instance,
        GlassReptRepetitionParser.instance
    ];

    private static readonly allTimingHintsParsers = [
        DefaultTimingHintsParser.instance
    ];

    // Singleton
    static instance = new MainParser(
        this.allInstructionParsers,
        this.allRepetitionParsers,
        this.allTimingHintsParsers);

    // Singleton
    static noMacroInstance = new MainParser(
        this.noMacroInstructionParsers,
        this.allRepetitionParsers,
        this.allTimingHintsParsers);

    // Available parsers for this instance
    private readonly instructionParsers: InstructionParser[];
    private readonly repetitionParsers: RepetitionParser[];
    private readonly timingHintsParsers: TimingHintsParser[];

    // Enabled parsers for this instance
    private enabledInstructionParsers: InstructionParser[] = [];
    private enabledRepetitionParsers: RepetitionParser[] = [];
    private enabledTimingHintsParsers: TimingHintsParser[] = [];

    private constructor(
        instructionParsers: InstructionParser[],
        repetitionParsers: RepetitionParser[],
        timingHintsParsers: TimingHintsParser[]) {

        this.instructionParsers = instructionParsers;
        this.repetitionParsers = repetitionParsers;
        this.timingHintsParsers = timingHintsParsers;

        this.initializeParsers();
    }

    onConfigurationChange(e: vscode.ConfigurationChangeEvent) {

        // Re-initializes parsers
        this.initializeParsers();
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

        const sourceCodes = this.extractSourceCode(s);
        if (!sourceCodes || !sourceCodes.length) {
            return undefined;
        }

        // Actual parsing
        const ret = new MeterableCollection();
        let meterables = ret;
        let repetitions = 1;

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
                previousMeterables.add(RepeatedMeterable.of(meterables, newRepetitions));
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

            // Parses the actual meterable, and optional timing hints and repetitions
            const meterable = TimingHintedMeterable.of(
                this.parseInstruction(sourceCode), this.parseTimingHints(sourceCode));
            if (!meterable) {
                return;
            }

            meterables.add(RepeatedMeterable.of(meterable, sourceCode.repetitions));
        });

        return ret.isEmpty() ? undefined : ret;
    }

    private extractSourceCode(s: string): SourceCode[] | undefined {

        // (sanity checks)
        if (!s) {
            return undefined;
        }
        const rawLines = s.split(/[\r\n]+/);
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

        // Splits the lines and extracts repetition counter and trailing comments
        var sourceCode: SourceCode[] = [];
        rawLines.forEach(rawLine => {
            sourceCode.push(...extractSourceCode(rawLine,
                config.syntax.lineSeparator,
                config.syntax.labelRegExp,
                config.syntax.repeatRegExp));
        });
        return (!sourceCode.length) ? undefined : sourceCode;
    }

    private parseInstruction(s: SourceCode): Meterable | undefined {

        // Tries to parse as an instruction
        for (let i = 0, n = this.enabledInstructionParsers.length; i < n; i++) {
            const parser = this.enabledInstructionParsers[i];
            const instruction = parser.parse(s);
            if (instruction) {
                return instruction;
            }
        }

        // (not an instruction)
        return undefined;
    }

    private parseRepetition(s: string): number | undefined {

        // Tries to parse as a repetition instruction
        for (let i = 0, n = this.enabledRepetitionParsers.length; i < n; i++) {
            const repetitionParser = this.enabledRepetitionParsers[i];
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
        for (let i = 0, n = this.enabledRepetitionParsers.length; i < n; i++) {
            const repetitionParser = this.enabledRepetitionParsers[i];
            if (repetitionParser.parseEnd(s)) {
                return true;
            }
        }

        // (not a repetition end instruction)
        return false;
    }

    private parseTimingHints(s: SourceCode): TimingHints | undefined {

        // Tries to parse timing hints
        for (let i = 0, n = this.enabledTimingHintsParsers.length; i < n; i++) {
            const parser = this.enabledTimingHintsParsers[i];
            const timingHints = parser.parse(s);
            if (timingHints) {
                return timingHints;
            }
        }

        // (no timing hints)
        return undefined;
    }
}
