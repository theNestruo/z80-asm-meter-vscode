import { Meterable } from './Meterable';

/**
 * An assembly directive, such as `db`, `dw` or `ds`
 */
 export class AssemblyDirective implements Meterable {

    // Information
    private directive: string;
    private bytes: string[];
    private size: number;

    constructor(
            directive: string, bytes: string[], size: number) {

        this.directive = directive;
        this.bytes = bytes;
        this.size = size;
    }

    /**
     * @returns The directive
     */
     public getInstruction(): string {
        return this.directive;
    }

    /**
     * @returns The Z80 timing, in time (T) cycles
     */
    public getZ80Timing(): number[] {
        return [0, 0];
    }

    /**
     * @returns The Z80 timing with the M1 wait cycles required by the MSX standard
     */
    public getMsxTiming(): number[] {
        return [0, 0];
    }

    /**
     * @returns The CPC timing, in NOPS
     */
    public getCpcTiming(): number[] {
        return [0, 0];
    }

    /**
     * @returns The bytes, logically grouped
     */
    public getBytes(): string[] {
        return this.bytes;
    }

    /**
     * @returns The size in bytes
     */
    public getSize(): number {
        return this.size;
    }
}