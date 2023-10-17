export class TimingHints {

    // Information
    readonly z80Timing: number[] | undefined;
    readonly msxTiming: number[] | undefined;
    readonly cpcTiming: number[] | undefined;

	constructor(
		z80Timing: number[] | undefined,
		msxTiming: number[] | undefined,
		cpcTiming: number[] | undefined) {

		this.z80Timing = z80Timing;
		this.msxTiming = msxTiming;
		this.cpcTiming = cpcTiming;
	}
}
