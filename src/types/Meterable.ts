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
	get isComposed(): boolean;
}
