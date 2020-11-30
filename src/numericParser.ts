import { workspace } from 'vscode';
import { Z80Instruction } from "./z80Instruction";
import { Z80InstructionSet } from './z80InstructionSet';
import { extractInstructionsFrom, formatTiming } from './z80Utils';

export class NumericParser {

    private regex: RegExp;
    private radix: number;

    constructor(regex: RegExp, radix: number) {
        this.regex = regex;
        this.radix = radix;
    }

    public parse(s: string): number | undefined {
        const matches = this.regex.exec(s);
        return matches && matches.length >= 1
                ? parseInt(matches[1], this.radix)
                : undefined;
    }
}
