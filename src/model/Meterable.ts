/**
 * Anything that can be metered: Z80 Instructions, ASM directives, sjasmplus fake instructions...
 */
export default interface Meterable {

    /**
     * @returns the normalized Z80 instruction, ASM directive, sjasmplus fake instruction...
     */
    getInstruction(): string;

    /**
     * @returns the Z80 timing, in time (T) cycles
     */
    getZ80Timing(): number[];

    /**
     * @returns the Z80 timing with the M1 wait cycles required by the MSX standard
     */
    getMsxTiming(): number[];

    /**
     * @returns the CPC timing, in NOPS
     */
    getCpcTiming(): number[];

    /**
     * @returns the bytes, logically grouped
     */
    getBytes(): string[];

    /**
     * @returns the size in bytes
     */
    getSize(): number;

    /**
     * @returns if the meterable is composed of finer-grained meterables
     */
    isComposed(): boolean;

    /**
     * @returns the flattened array of the finer-grained meterables that compose this meterable
     * (when the meterable is composed); empty array otherwise
     */
    decompose(): Meterable[];
}
