/**
 * Anything that can be metered: Z80 Instructions, ASM directives, sjasmplus fake instructions...
 */
export interface Meterable {

    /**
     * @returns The normalized Z80 instruction, ASM directive, sjasmplus fake instruction...
     */
    getInstruction(): string;

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
    getZ80Timing(): number[];

    /**
     * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
     */
    getMsxTiming(): number[];

    /**
     * @returns The CPC timing, in NOPS
     */
    getCpcTiming(): number[];

    /**
     * @returns The bytes, logically grouped
     */
    getBytes(): string[];

    /**
     * @returns The size in bytes
     */
    getSize(): number;
}
