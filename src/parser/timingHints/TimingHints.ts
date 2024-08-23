export class TimingHints {

    // Information
    readonly z80Timing?: number[];
    readonly msxTiming?: number[];
    readonly cpcTiming?: number[];

	constructor(
		z80Timing?: number[],
		msxTiming?: number[],
		cpcTiming?: number[]) {

		this.z80Timing = z80Timing;
		this.msxTiming = msxTiming;
		this.cpcTiming = cpcTiming;
	}
}
