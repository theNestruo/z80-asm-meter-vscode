/**
 * A container for source code:
 * an instruction, and an optional trailing comment of the entire line
 */
export class SourceCode {

    /** The instruction (the actual source code) */
    readonly instruction: string;

    /** The optional line repetition count */
    readonly repetitions: number;

    /** The optional trailing comment of the entire line */
    readonly lineComment: string | undefined;

    constructor(instruction: string, repetitions?: number, lineComment?: string) {
        this.instruction = instruction;
        this.repetitions = repetitions || 1;
        this.lineComment = lineComment;
    }
}
