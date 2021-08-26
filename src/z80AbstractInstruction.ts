import { extractMnemonicOf, extractOperandsOf, formatHexadecimalByte, formatTiming, parseTimings } from './z80Utils';

export abstract class Z80AbstractInstruction {

    /**
     * @returns The raw instruction
     */
     public abstract getInstruction(): string;

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
    public abstract getZ80Timing(): number[];

    /**
     * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
     */
    public abstract getMsxTiming(): number[];

    /**
     * @returns The CPC timing, in NOPS
     */
    public abstract getCpcTiming(): number[];

    /**
     * @returns The bytes of the instruction
     */
    public abstract getBytes(): string;

    /**
     * @returns The size in bytes
     */
    public abstract getSize(): number;
}
