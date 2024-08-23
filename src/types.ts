/**
 * A container for source code:
 * an instruction, and an optional trailing comment of the entire line
 */
export class SourceCode {

    /** The optional label */
    readonly label: string | undefined;

    /** The optional line repetition count */
    readonly repetitions: number;

    /** The instruction (the actual source code) */
    readonly instruction: string;

    /** The optional trailing comment of the entire line */
    readonly lineComment: string | undefined;

    constructor(label: string | undefined, repetitions: number, instruction: string, lineComment: string | undefined) {
        this.label = label;
        this.repetitions = repetitions;
        this.instruction = instruction;
        this.lineComment = lineComment;
    }
}

/**
 * Anything that can be metered: Z80 Instructions, ASM directives, sjasmplus fake instructions...
 */
export interface Meterable {

    /**
     * @returns the normalized Z80 instruction, ASM directive, sjasmplus fake instruction...
     */
    get instruction(): string;

    /**
     * @returns the Z80 timing, in time (T) cycles
     */
    get z80Timing(): number[];

    /**
     * @returns the Z80 timing with the M1 wait cycles required by the MSX standard
     */
    get msxTiming(): number[];

    /**
     * @returns the CPC timing, in NOPS
     */
    get cpcTiming(): number[];

    /**
     * @returns the bytes, logically grouped
     */
    get bytes(): string[];

    /**
     * @returns the size in bytes
     */
    get size(): number;

    /**
     * @returns the flattened array of the finer-grained meterables
	 * that compose this meterable (when the meterable is composed);
	 * an array with this meterable otherwise.
     * For displaying instructions and bytes purposes only!
     */
    flatten(): Meterable[];

    /**
     * @returns if the meterable is composed of finer-grained meterables
     */
    get composed(): boolean;
}


/**
 * Anything that can be metered by aggregation of meterables
 */
export abstract class AbstractAggregatedMeterable implements Meterable {

	abstract get instruction(): string;

	abstract get z80Timing(): number[];

	abstract get msxTiming(): number[];

	abstract get cpcTiming(): number[];

	abstract get bytes(): string[];

	abstract get size(): number;

	/**
	 * @returns the flattened array of the finer-grained meterables that compose this meterable
	 */
	abstract flatten(): Meterable[];

	/** true; this meterable is composed */
	composed = true;
}


/**
 * A meterable collection of Meterables
 */
export class MeterableCollection extends AbstractAggregatedMeterable {

	// The collection of meterable instances
	protected meterables: Meterable[] = [];

    // Derived information (will be cached for performance reasons)
    private cachedZ80Timing?: number[];
    private cachedMsxTiming?: number[];
    private cachedCpcTiming?: number[];
    private cachedBytes?: string[];
    private cachedSize?: number;
	private cachedMeterables?: Meterable[];

	/**
	 * Adds a meterable to the aggregation
	 * @param meterable The Meterable to aggregate
	 * @return true if the meterable was aggregated; false otherwise
	 */
	add(meterable?: Meterable): boolean {

		// (sanity check)
		if (!meterable) {
			return false;
		}

		this.meterables.push(meterable);

		this.cachedZ80Timing = undefined;
		this.cachedMsxTiming = undefined;
		this.cachedCpcTiming = undefined;
		this.cachedBytes = undefined;
		this.cachedSize = undefined;
		this.cachedMeterables = undefined;

		return true;
	}

	get instruction(): string {
		return "";
	}

	get z80Timing(): number[] {

		if (!this.cachedZ80Timing) {
			const totalZ80Timing: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const z80Timing = meterable.z80Timing;
				totalZ80Timing[0] += z80Timing[0];
				totalZ80Timing[1] += z80Timing[1];
			});
			this.cachedZ80Timing = totalZ80Timing;
		}
		return this.cachedZ80Timing;
	}

	get msxTiming(): number[] {

		if (!this.cachedMsxTiming) {
			const totalMsxTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const msxTiming = meterable.msxTiming;
				totalMsxTiming[0] += msxTiming[0];
				totalMsxTiming[1] += msxTiming[1];
			});
			this.cachedMsxTiming = totalMsxTiming;
		}
		return this.cachedMsxTiming;
	}

	get cpcTiming(): number[] {

		if (!this.cachedCpcTiming) {
			const totalCpcTiming: number[] = [0, 0];
			this.meterables.forEach(meterable => {
				const cpcTiming = meterable.cpcTiming;
				totalCpcTiming[0] += cpcTiming[0];
				totalCpcTiming[1] += cpcTiming[1];
			});
			this.cachedCpcTiming = totalCpcTiming;
		}
		return this.cachedCpcTiming;
	}

	get bytes(): string[] {

		if (!this.cachedBytes) {
			const bytes: string[] = [];
			this.meterables.forEach(meterable => bytes.push(...meterable.bytes));
			this.cachedBytes = bytes;
		}
		return this.cachedBytes;
	}

	get size(): number {

		if (!this.cachedSize) {
			let size: number = 0;
			this.meterables.forEach(meterable => size += meterable.size);
			this.cachedSize = size;
		}
		return this.cachedSize;
	}

	flatten(): Meterable[] {

		if (!this.cachedMeterables?.length) {
			const meterables: Meterable[] = [];
			this.meterables.forEach(meterable => {
				if (meterable.composed) {
					meterables.push(...meterable.flatten());
				} else {
					meterables.push(meterable);
				}
			});
			this.cachedMeterables = meterables;
		}
		return this.cachedMeterables;
	}
}
