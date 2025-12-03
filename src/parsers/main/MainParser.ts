import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from '../../config';
import { MeterableCollection, RepeatedMeterable } from "../../types/AggregatedMeterable";
import { InstructionParser } from "../../types/InstructionParser";
import { Meterable } from "../../types/Meterable";
import { RepetitionParser } from "../../types/RepetitionParser";
import { SourceCode } from "../../types/SourceCode";
import { TimingHintedMeterable, TimingHints } from '../../types/TimingHintedMeterable';
import { TimingHintsParser } from "../../types/TimingHintsParser";
import { OptionalSingletonHolder, SingletonHolderImpl } from '../../utils/Lifecycle';
import { assemblyDirectiveParser } from '../instructions/AssemblyDirectiveParser';
import { glassFakeInstructionParser, glassReptRepetitionParser } from '../instructions/GlassParser';
import { macroParser } from '../instructions/MacroParser';
import { sjasmplusDupRepetitionParser, sjasmplusFakeInstructionParser, sjasmplusRegisterListInstructionParser, sjasmplusReptRepetitionParser } from '../instructions/SjasmplusParser';
import { z80InstructionParser } from '../instructions/Z80InstructionParser';
import { defaultTimingHintsParser } from '../timingHints/DefaultTimingHintsParser';
import { regExpTimingHintsParser } from '../timingHints/RegExpTimingHintsParser';

class MainParserHolder extends SingletonHolderImpl<MainParser> {

    private readonly _disposable: vscode.Disposable;

    constructor(
        private readonly instructionParserHolders: OptionalSingletonHolder<InstructionParser>[],
        private readonly repetitionParserHolders: OptionalSingletonHolder<RepetitionParser>[],
        private readonly timingHintParserHolders: OptionalSingletonHolder<TimingHintsParser>[]) {

        super();

        this._disposable =
            // Subscribe to configuration change event
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
    }

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        // Forces re-creation
		this._instance?.dispose();
        this._instance = undefined;
    }

    override dispose() {
        this._disposable.dispose();

        super.dispose();
    }

    protected override createInstance(): MainParser {

        return new MainParser(
            this.instructionParserHolders.map(holder => holder.instance).filter(instance => !!instance),
            this.repetitionParserHolders.map(holder => holder.instance).filter(instance => !!instance),
            this.timingHintParserHolders.map(holder => holder.instance).filter(instance => !!instance)
        );
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

const allRepetitionParsers = [
    sjasmplusDupRepetitionParser,
    sjasmplusReptRepetitionParser,
    glassReptRepetitionParser
];

const allTimingHintsParsers = [
    defaultTimingHintsParser,
    regExpTimingHintsParser
];


export const mainParser = new MainParserHolder(
    allInstructionParsers,
    allRepetitionParsers,
    allTimingHintsParsers);

export const mainParserForMacroParser = new MainParserHolder(
    allInstructionParsers.filter(parser => parser !== macroParser), // (prevent circular nesting)
    allRepetitionParsers,
    allTimingHintsParsers);

export const mainParserForTimingHintsParsers = new MainParserHolder(
    allInstructionParsers,
    allRepetitionParsers,
    []); // (do not use timing hint parsers)

//

/**
 * Actual implementation of the main parser
 */
class MainParser implements vscode.Disposable {

    private readonly _disposable: vscode.Disposable;

    private instructionsCache;

    constructor(
        private readonly instructionParsers: InstructionParser[],
        private readonly repetitionParsers: RepetitionParser[],
        private readonly timingHintsParsers: TimingHintsParser[]) {

        this._disposable =
		    // Subscribe to configuration change event
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);

        // Initializes cache
		this.instructionsCache = HLRU(config.parser.instructionsCacheSize);
    }

	dispose() {
        this.instructionsCache.clear();
        this._disposable.dispose();
	}

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        // Re-initializes cache
		this.instructionsCache = HLRU(config.parser.instructionsCacheSize);
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
                previousMeterables.add(RepeatedMeterable.of(meterables, newRepetitions));
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
                meterable = TimingHintedMeterable.from(meterable, timingHints, sourceCode);
            }
            if (!meterable) {
                return;
            }

            meterables.add(RepeatedMeterable.of(meterable, sourceCode.repetitions));
            isEmpty = false;
        });

        return isEmpty ? undefined : ret;
    }

    private parseRepetition(s: string): number | undefined {

        // Tries to parse as a repetition instruction
        for (const repetitionParser of this.repetitionParsers) {
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
        for (const repetitionParser of this.repetitionParsers) {
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
        for (const parser of this.instructionParsers) {
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
        for (const parser of this.timingHintsParsers) {
            const timingHints = parser.parse(s);
            if (timingHints) {
                return timingHints;
            }
        }

        // (no timing hints)
        return undefined;
    }
}
