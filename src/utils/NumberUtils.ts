class NumericExpressionParser {

    private regexp: RegExp;
    private radix: number;

    constructor(regexp: RegExp, radix: number) {
        this.regexp = regexp;
        this.radix = radix;
    }

    parse(s: string): number | undefined {
        const negative = s.startsWith("-");
        const us = negative ? s.substring(1) : s;
        const matches = this.regexp.exec(us);
        return matches && matches.length >= 1
            ? (negative ? -1 : 1) * parseInt(matches[1], this.radix)
            : undefined;
    }
}

const numericParsers: NumericExpressionParser[] = [
    new NumericExpressionParser(/^0[Xx]([0-9A-Fa-f]+)$/, 16),
    new NumericExpressionParser(/^[#$&]([0-9A-Fa-f]+)$/, 16),
    new NumericExpressionParser(/^([0-9A-Fa-f]+)[Hh]$/, 16),
    new NumericExpressionParser(/^[0@]([0-7]+)$/, 8),
    new NumericExpressionParser(/^([0-7]+)[Oo]$/, 8),
    new NumericExpressionParser(/^%([01]+)$/, 2),
    new NumericExpressionParser(/^([01]+)[Bb]$/, 2),
    new NumericExpressionParser(/^([0-9]+)$/, 10)
];

export function parseNumericExpression(s: string, includeNegatives: boolean = true): number | undefined {

    const negative = s.startsWith("-");
    if ((!includeNegatives) && negative) {
        return undefined;
    }

    const us = negative ? s.substring(1).trim() : s;

    for (const numericParser of numericParsers) {
        const value = numericParser.parse(us);
        if ((value !== undefined)
            && (!isNaN(value))) {
            return negative ? -value : value;
        }
    }

    return undefined;
}

export function parteIntLenient(o: unknown): number | undefined {

    if (typeof o === "number") {
        return isNaN(o) ? undefined : o;
    }

    if (typeof o === "string") {
        return parseNumericExpression(o);
    }

    return undefined;
}

export function formatHexadecimalNumber(n: number): string {

    return n.toString(16).toUpperCase();
}
