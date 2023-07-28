import Meterable from '../../../model/Meterable';

/**
 * An assembly directive, such as `db`, `dw` or `ds`
 */
export default class AssemblyDirective implements Meterable {

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
     getInstruction(): string {
        return this.directive;
    }

    getZ80Timing(): number[] {
        return [0, 0];
    }

    getMsxTiming(): number[] {
        return [0, 0];
    }

    getCpcTiming(): number[] {
        return [0, 0];
    }

    getBytes(): string[] {
        return this.bytes;
    }

    getSize(): number {
        return this.size;
    }

    isComposed(): boolean {
        return false;
    }

    decompose(): Meterable[] {
		return [];
    }
}
