export class TimingHints {

    // Information
    private readonly z80TimingHint: number[] | undefined;
    private readonly msxTimingHint: number[] | undefined;
    private readonly cpcTimingHint: number[] | undefined;
	private readonly timingHint: number[];

	constructor(
		z80TimingHint: number[] | undefined,
		msxTimingHint: number[] | undefined,
		cpcTimingHint: number[] | undefined,
		timingHint: number[] | undefined) {

		this.z80TimingHint = z80TimingHint;
		this.msxTimingHint = msxTimingHint;
		this.cpcTimingHint = cpcTimingHint;
		this.timingHint = timingHint || [0, 0];
	}

	get instruction(): string {
		return "";
	}

	get z80Timing(): number[] {

		return this.z80TimingHint || this.timingHint;
	}

	get msxTiming(): number[] {

		return this.msxTimingHint || this.timingHint;
	}

	get cpcTiming(): number[] {

		return this.cpcTimingHint || this.timingHint;
	}
}
