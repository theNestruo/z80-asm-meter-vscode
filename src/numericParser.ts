export class NumericParser {

    private regex: RegExp;
    private radix: number;

    constructor(regex: RegExp, radix: number) {
        this.regex = regex;
        this.radix = radix;
    }

    public parse(s: string): number | undefined {
        const negative = s.startsWith('-');
        const us = negative ? s.substr(1) : s;
        const matches = this.regex.exec(us);
        return matches && matches.length >= 1
                ? (negative ? -1 : 1) * parseInt(matches[1], this.radix)
                : undefined;
    }
}
