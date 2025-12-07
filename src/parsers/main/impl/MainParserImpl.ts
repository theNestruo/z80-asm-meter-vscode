import HLRU from "hashlru";
import { config } from "../../../config";
import type { Activable } from "../../../types/Activable";
import { MeterableCollection, RepeatedMeterable } from "../../../types/AggregatedMeterables";
import type { Meterable } from "../../../types/Meterable";
import type { OptionalSingletonRef } from "../../../types/References";
import { ConfigurableSingletonRefImpl } from "../../../types/References";
import type { SourceCode } from "../../../types/SourceCode";
import type { InstructionParser } from "../../instructions/types/InstructionParser";
import type { RepetitionParser } from "../../instructions/types/RepetitionParser";
import { TimingHintedMeterable } from "../../timingHints/types/TimingHintedMeterable";
import type { TimingHints } from "../../timingHints/types/TimingHints";
import type { TimingHintsParser } from "../../timingHints/types/TimingHintsParser";
import type { MainParser } from "../types/MainParser";

export class MainParserRef extends ConfigurableSingletonRefImpl<MainParser, MainParserImpl> implements Activable {

	constructor(
		private readonly instructionParserRefs: OptionalSingletonRef<InstructionParser>[],
		private readonly repetitionParserRefs: OptionalSingletonRef<RepetitionParser>[],
		private readonly timingHintParserRefs: OptionalSingletonRef<TimingHintsParser>[]) {
		super();
	}

	protected override createInstance(): MainParserImpl {
		return new MainParserImpl(
			this.instructionParserRefs.map(ref => ref.instance).filter(instance => !!instance),
			this.repetitionParserRefs.map(ref => ref.instance).filter(instance => !!instance),
			this.timingHintParserRefs.map(ref => ref.instance).filter(instance => !!instance)
		);
	}
}

//

/**
 * Actual implementation of the main parser
 */
class MainParserImpl implements MainParser {

	private readonly instructionsCache;

	constructor(
		private readonly instructionParsers: InstructionParser[],
		private readonly repetitionParsers: RepetitionParser[],
		private readonly timingHintsParsers: TimingHintsParser[]) {

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
		for (const sourceCode of sourceCodes) {

			// Handles repetition start
			const newRepetitions = this.parseBeginRepetition(sourceCode.instruction);
			if (newRepetitions !== undefined) {
				const previousMeterables = meterables;
				meterablesStack.push(meterables);
				meterables = new MeterableCollection();
				previousMeterables.add(RepeatedMeterable.of(meterables, newRepetitions));
				repetitionsStack.push(repetitions);
				repetitions *= newRepetitions;
				continue;
			}

			// Handles repetition end
			if (this.parseEndRepetition(sourceCode.instruction)) {
				meterables = meterablesStack.pop() ?? ret;
				repetitions = repetitionsStack.pop() ?? 1;
				continue;
			}

			// Parses the actual meterable and optional timing hints
			let meterable = this.parseInstruction(sourceCode);
			const timingHints = this.parseTimingHints(sourceCode);
			if (timingHints) {
				meterable = TimingHintedMeterable.from(meterable, timingHints, sourceCode);
			}

			if (meterable) {
				meterables.add(RepeatedMeterable.of(meterable, sourceCode.repetitions));
				isEmpty = false;
			}
		}

		return isEmpty ? undefined : ret;
	}

	parseInstruction(s: SourceCode): Meterable | undefined {

		// Uses the cached value
		if (this.instructionsCache.has(s.instruction)) {
			return this.instructionsCache.get(s.instruction) as Meterable;
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
}
