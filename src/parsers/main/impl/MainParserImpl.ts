import HLRU from 'hashlru';
import * as vscode from 'vscode';
import { config } from '../../../config';
import { MeterableCollection, RepeatedMeterable } from "../../../types/AggregatedMeterables";
import { Meterable } from "../../../types/Meterable";
import { OptionalSingletonRef, SingletonRefImpl } from '../../../types/References';
import { SourceCode } from "../../../types/SourceCode";
import { InstructionParser } from "../../instructions/types/InstructionParser";
import { RepetitionParser } from "../../instructions/types/RepetitionParser";
import { TimingHintsParser } from "../../timingHints/types/TimingHintsParser";
import { MainParser } from '../types/MainParser';
import { TimingHintedMeterable } from '../../timingHints/types/TimingHintedMeterable';
import { TimingHints } from '../../timingHints/types/TimingHints';

export class MainParserRef extends SingletonRefImpl<MainParser, MainParserImpl> {

    private readonly _disposable: vscode.Disposable;

    constructor(
        private readonly instructionParserRefs: OptionalSingletonRef<InstructionParser>[],
        private readonly repetitionParserRefs: OptionalSingletonRef<RepetitionParser>[],
        private readonly timingHintParserRefs: OptionalSingletonRef<TimingHintsParser>[]) {
        super();

        this._disposable =
            // Subscribe to configuration change event
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChange, this);
    }

    protected override createInstance(): MainParserImpl {
        return new MainParserImpl(
            this.instructionParserRefs.map(ref => ref.instance).filter(instance => !!instance),
            this.repetitionParserRefs.map(ref => ref.instance).filter(instance => !!instance),
            this.timingHintParserRefs.map(ref => ref.instance).filter(instance => !!instance)
        );
    }

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        // Forces instance re-creation
        this.destroyInstance();
    }

    override dispose() {
        this._disposable.dispose();
        super.dispose();
    }
}

//

/**
 * Actual implementation of the main parser
 */
class MainParserImpl implements MainParser, vscode.Disposable {

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
            const newRepetitions = this.parseBeginRepetition(sourceCode.instruction);
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
            if (this.parseEndRepetition(sourceCode.instruction)) {
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

    parseInstruction(s: SourceCode): Meterable | undefined {

        const cachedMeterable = this.instructionsCache.get(s.instruction);

        // Uses the cached value
        if (cachedMeterable) {
			return cachedMeterable;
		}

        // Tries to parse as an instruction
        for (const parser of this.instructionParsers) {
            const instruction = parser.parseInstruction(s);
            if (instruction) {
                // Caches value
                this.instructionsCache.set(s.instruction, instruction);
                return instruction;
            }
        }

        // (not an instruction)
        return undefined;
    }

    parseBeginRepetition(s: string): number | undefined {

        // Tries to parse as a repetition instruction
        for (const repetitionParser of this.repetitionParsers) {
            const count = repetitionParser.parseBeginRepetition(s);
            if (count !== undefined) {
                return count;
            }
        }

        // (not a repetition instruction)
        return undefined;
    }

    parseEndRepetition(s: string): boolean {

        // Tries to parse as a repetition end instruction
        for (const repetitionParser of this.repetitionParsers) {
            if (repetitionParser.parseEndRepetition(s)) {
                return true;
            }
        }

        // (not a repetition end instruction)
        return false;
    }

    parseTimingHints(s: SourceCode): TimingHints | undefined {

        // Tries to parse timing hints
        for (const parser of this.timingHintsParsers) {
            const timingHints = parser.parseTimingHints(s);
            if (timingHints) {
                return timingHints;
            }
        }

        // (no timing hints)
        return undefined;
    }

    onConfigurationChange(_e: vscode.ConfigurationChangeEvent) {

        // Re-initializes cache
		this.instructionsCache = HLRU(config.parser.instructionsCacheSize);
    }

	dispose() {
        this.instructionsCache.clear();
        this._disposable.dispose();
	}
}
