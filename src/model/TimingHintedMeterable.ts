import { config } from "../config";
import { mainParserWithoutTimingHints } from "../parser/MainParser";
import { isConditionalInstruction, isJumpOrCallInstruction } from "../utils/AssemblyUtils";
import { Meterable, MeterableCollection } from "./Meterables";
import { SourceCode } from "./SourceCode";
import { TimingHints } from "./TimingHints";

export function timingHintedMeterable(
	meterable: Meterable | undefined, timingHints: TimingHints, sourceCode: SourceCode):
	Meterable | undefined {

	switch (config.timing.hints.enabledValue) {
		case "disabled":
			// (should never happen)
			return meterable;

		case "subroutines":
			// Applies to CALL, DJNZ, JP, JR, RET or RST instructions only
			return meterable && isJumpOrCallInstruction(meterable.instruction)
				? new TimingHintedMeterable(meterable, timingHints)
				: meterable;

		case "any":
			// Allows no meterable (timing hint on empty line)
			return meterable
				? new TimingHintedMeterable(meterable, timingHints)
				: new TimingHintedMeterable(new MeterableCollection(), timingHints);

		case "ignoreCommentedOut":
			return meterable
				? new TimingHintedMeterable(meterable, timingHints)
				// Excludes commented out code
				: isCommentedOutSourceCode(sourceCode)
					? undefined
					: new TimingHintedMeterable(new MeterableCollection(), timingHints);
		}
}

function isCommentedOutSourceCode(sourceCode: SourceCode): boolean {

	return !sourceCode.instruction // non empty line (should never happen)
		&& !!sourceCode.lineComment // no comment (should never happen)
		&& !!mainParserWithoutTimingHints.parse(sourceCode.lineComment);
}

class TimingHintedMeterable implements Meterable {

	// The meterable instance
	private meterable: Meterable;

	// The hinted meterable instance
	private timingHints: TimingHints;

    // Information
	private conditional: boolean;

	constructor(meterable: Meterable, timingHints: TimingHints) {

		this.meterable = meterable;
		this.timingHints = timingHints;

		this.conditional = isConditionalInstruction(meterable.instruction);
	}

	get instruction(): string {
		return this.meterable.instruction;
	}

	get z80Timing(): number[] {

		return this.modifiedTimingOf(this.meterable.z80Timing, this.timingHints.z80Timing);
	}

	get msxTiming(): number[] {

		return this.modifiedTimingOf(this.meterable.msxTiming, this.timingHints.msxTiming);
	}

	get cpcTiming(): number[] {

		return this.modifiedTimingOf(this.meterable.cpcTiming, this.timingHints.cpcTiming);
	}

	get bytes(): string[] {

		return this.meterable.bytes;
	}

	get size(): number {

		return this.meterable.size;
	}

	flatten(): Meterable[] {
		return [this];
	}

	get composed(): boolean {
		return false;
	}

	private modifiedTimingOf(timing: number[], addend: number[] | undefined): number[] {

		// (sanity check)
		if (!addend) {
			return timing;
		}

		// Conditional instruction?
		return this.conditional
			? [ timing[0] + addend[0], timing[1] ]
			: [ timing[0] + addend[0], timing[1] + addend[1] ];
	}
}
