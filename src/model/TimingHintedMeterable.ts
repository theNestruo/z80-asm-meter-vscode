import { config } from "../config";
import { isConditionalInstruction, isJumpOrCallInstruction } from "../utils/AssemblyUtils";
import { Meterable } from "./Meterable";
import { MeterableCollection } from "./MeterableCollection";
import { TimingHints } from "./TimingHints";

export function timingHintedMeterable(meterable: Meterable | undefined, timingHints: TimingHints | undefined): Meterable | undefined {

	// No timing hints
	if (!timingHints) {
		return meterable;
	}

	// No meterable (just timing hints if lenient)
	if (!meterable) {
		return config.timing.hints === "any"
			? new TimingHintedMeterable(new MeterableCollection(), timingHints)
			: undefined;
	}

	// Meterable
	return config.timing.hints === "any" || isJumpOrCallInstruction(meterable.instruction)
		? new TimingHintedMeterable(meterable, timingHints)
		: meterable;
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
		return this.meterable.flatten();
	}

	get composed(): boolean {
		return this.meterable.composed;
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
