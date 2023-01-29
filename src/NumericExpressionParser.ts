export class NumericExpressionParser {

    public static parse(s: string): number | undefined {

        for (const numericParser of NumericExpressionParser.numericParsers) {
            const value = numericParser.parse(s);
            if ((value !== undefined) && (!isNaN(value))) {
                return value;
            }
        }

        return undefined;
    }

    // Instances
    private static numericParsers: NumericExpressionParser[] = [
        new NumericExpressionParser(/^0x([0-9a-f]+)$/i, 16),
        new NumericExpressionParser(/^[#$&]([0-9a-f]+)$/i, 16),
        new NumericExpressionParser(/^([0-9a-f]+)h$/i, 16),
        new NumericExpressionParser(/^[0@]([0-7]+)$/, 8),
        new NumericExpressionParser(/^([0-7]+)o$/i, 8),
        new NumericExpressionParser(/^%([0-1]+)$/i, 2),
        new NumericExpressionParser(/^([0-1]+)b$/i, 2),
        new NumericExpressionParser(/^(\d+)$/, 10)
    ];

    private regex: RegExp;
    private radix: number;

    private constructor(regex: RegExp, radix: number) {
        this.regex = regex;
        this.radix = radix;
    }

    private parse(s: string): number | undefined {
        const negative = s.startsWith("-");
        const us = negative ? s.substring(1) : s;
        const matches = this.regex.exec(us);
        return matches && matches.length >= 1
            ? (negative ? -1 : 1) * parseInt(matches[1], this.radix)
            : undefined;
    }
}
