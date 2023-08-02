import { workspace } from 'vscode';
import Meterable from '../model/Meterable';
import MeterableCollection from '../model/MeterableCollection';
import MeterableRepetition from '../model/MeterableRepetition';
import SourceCodeLine from '../model/SourceCodeLine';
import SourceCodePart from '../model/SourceCodePart';
import TimingHintDecorator from '../timing/TimingHintDecorator';
import { normalizeAndSplitQuotesAware } from '../utils/utils';
import NumericExpressionParser from "./NumericExpressionParser";
import AssemblyDirectiveParser from './directive/AssemblyDirectiveParser';
import MacroParser from './macro/MacroParser';
import SjasmplusFakeInstructionParser from './sjasmplus/SjasmplusFakeInstructionParser';
import SjasmplusRegisterListInstructionParser from './sjasmplus/SjasmplusRegisterListInstructionParser';
import Z80InstructionParser from './z80/Z80InstructionParser';
import MeterableHint from '../model/MeterableHint';
import SjasmplusDupParser from './sjasmplus/SjasmplusDupParser';

export default class MainParser {

    // Configuration
    private platformConfiguration: string;
    private sjasmplusConfiguration: boolean;
    private syntaxLabelConfiguration: string;
    private syntaxLineSeparatorConfiguration: string;
    private syntaxRepeatConfiguration: string;
    private timingsHintsConfiguration: string;

    constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.sjasmplusConfiguration = configuration.get("sjasmplus", false);
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");
        this.syntaxRepeatConfiguration = configuration.get("syntax.repeat", "none");
        this.timingsHintsConfiguration = configuration.get("timings.hints", "none");
    }

    parse(rawSourceCode: string): MeterableCollection {

        const emptyMeterablesCollection = new MeterableCollection();

        // (sanity checks)
        if (!rawSourceCode) {
            return emptyMeterablesCollection;
        }
        const rawSourceCodeLines = rawSourceCode.split(/[\r\n]+/);
        if (rawSourceCodeLines.length === 0) {
            return emptyMeterablesCollection;
        }
        if (rawSourceCodeLines[rawSourceCodeLines.length - 1].trim() === "") {
            // (removes possible spurious empty line at the end of the selection)
            rawSourceCodeLines.pop();
            if (rawSourceCodeLines.length === 0) {
                return emptyMeterablesCollection;
            }
        }

        // Determines syntax
        const labelRegExp = this.syntaxLabelConfiguration === "colonOptional"
            ? /(^[^\s:]+([\s:]|$))/
            : /(^\s*[^\s:]+:)/;
        const lineSeparator =
            this.syntaxLineSeparatorConfiguration === "colon" ? ":"
            : this.syntaxLineSeparatorConfiguration === "pipe" ? "|"
            : undefined;

        return this.sjasmplusConfiguration
            ? this.parseSjasm(rawSourceCodeLines, labelRegExp, lineSeparator)
            : this.parseFlat(rawSourceCodeLines, labelRegExp, lineSeparator);
    }

    private parseFlat(rawSourceCodeLines: string[],
        labelRegExp: RegExp, lineSeparator: string | undefined): MeterableCollection {

        const meterables = new MeterableCollection();

        // Extracts the source code parts for every line
        rawSourceCodeLines.forEach(rawSourceCodeLine => {
            const sourceCodeParts =
                this.extractSourceCodePartsFrom(rawSourceCodeLine, labelRegExp, lineSeparator);

            // Parses the source code parts
            sourceCodeParts.forEach(sourceCodePart => {
                meterables.add(this.parseSourceCodePart(sourceCodePart));
            });
        });

        return meterables;
    }

    private parseSjasm(rawSourceCodeLines: string[],
        labelRegExp: RegExp, lineSeparator: string | undefined): MeterableCollection {

        const ret = new MeterableCollection();
        let meterables = ret;
        let repeatCount = 1;

        const meterablesStack: MeterableCollection[] = [];
        const repeatCountStack: number[] = [];

        // Extracts the source code parts for every line
        rawSourceCodeLines.forEach(rawSourceCodeLine => {
            const sourceCodeParts =
                this.extractSourceCodePartsFrom(rawSourceCodeLine, labelRegExp, lineSeparator);

            // Parses the source code parts
            sourceCodeParts.forEach(sourceCodePart => {

                const rawPart = sourceCodePart.getPart();
                const newRepeatCount = SjasmplusDupParser.instance.parseDupOrRept(rawPart);
                if (newRepeatCount !== undefined) {
                    const previousMeterables = meterables;
                    meterablesStack.push(meterables);
                    meterables = new MeterableCollection();
                    repeatCount *= newRepeatCount;
                    previousMeterables.add(MeterableRepetition.of(meterables, newRepeatCount));
                    return;
                }

                if (SjasmplusDupParser.instance.parseEdupOrEndr(rawPart)) {
                    meterables = meterablesStack.pop() || ret;
                    repeatCount = repeatCountStack.pop() || 1;
                    return;
                }

                meterables.add(this.parseSourceCodePart(sourceCodePart));
            });
        });

        return ret;
    }

    private extractSourceCodePartsFrom(rawSourceCodeLine: string,
        labelRegExp: RegExp, lineSeparator: string | undefined): SourceCodePart[] {

        // Removes surrounding label and whitespace
        const cleanRawSourceCodeLine = rawSourceCodeLine.replace(labelRegExp, "").trim();

        // Splits the line and extracts trailing comment
        return normalizeAndSplitQuotesAware(cleanRawSourceCodeLine, lineSeparator).getParts();
    }

    private parseSourceCodePart(sourceCodePart: SourceCodePart): Meterable | undefined {

        const rawPart = sourceCodePart.getPart();

        // Tries to parse timing hints from the comment
        const isTimingsHintsSubroutines = this.timingsHintsConfiguration === "subroutines";
        const isTimingsHintsAny = this.timingsHintsConfiguration === "any";
        const timingHints = isTimingsHintsSubroutines || isTimingsHintsAny
                ? MeterableHint.of(sourceCodePart.getComment())
                : undefined;

        // Actually parses the source code part
        var meterable = this.parseRawInstruction(this.extractRawInstruction(rawPart));
        if (!meterable) {
            // No source code; returns timing hints (if any)
            return isTimingsHintsAny ? timingHints : undefined;
        }

        // Decorates source code with the optional timing hints (if any)
        if (timingHints) {
            meterable = TimingHintDecorator.of(meterable, timingHints, isTimingsHintsSubroutines);
        }

        // Parses and applies the optional repeat pseudo-op
        return MeterableRepetition.of(meterable, this.extractRepeatCount(rawPart));
    }

    private extractRawInstruction(s: string): string {

        // Determines syntax
        const repeatRegExp =
            this.syntaxRepeatConfiguration === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
                : this.syntaxRepeatConfiguration === "dot" ? /^(?:\.(\S+)\s)(.+)$/
                    : undefined;
        if (!repeatRegExp) {
            return s;
        }

        // Tries to parse beyond the repeat pseudo-op
        const matches = repeatRegExp.exec(s);
        const hasRepeatInstruction = matches && matches.length >= 2 && matches[2];
        return hasRepeatInstruction ? matches[2] : s;
    }

    private extractRepeatCount(s: string): number {

        // Determines syntax
        const repeatRegExp =
            this.syntaxRepeatConfiguration === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
                : this.syntaxRepeatConfiguration === "dot" ? /^(?:\.(\S+)\s)(.+)$/
                    : undefined;
        if (!repeatRegExp) {
            return 1;
        }

        // Tries to parse repeat pseudo-op
        const matches = repeatRegExp.exec(s);
        const hasRepeatCount = matches && matches.length >= 1 && matches[1];
        if (!hasRepeatCount) {
            return 1;
        }
        const repeatCountCandidate = NumericExpressionParser.parse(matches[1]);
        return repeatCountCandidate && repeatCountCandidate > 0 ? repeatCountCandidate : 1;
    }

    private parseRawInstruction(s: string): Meterable | undefined {

        // Determines instruction sets
        const instructionSets =
            this.platformConfiguration === "z80n" ? ["S", "N"]
                : ["S"];

        // Tries to parse Z80 instructions
        const z80Instruction = Z80InstructionParser.instance.parseInstruction(s, instructionSets);
        if (z80Instruction) {
            return z80Instruction;
        }

        // Tries to parse sjasmplus alternative syntax and fake instructions
        if (this.sjasmplusConfiguration) {
            const sjasmplusFakeInstruction =
                SjasmplusFakeInstructionParser.instance.parse(s, instructionSets);
            if (sjasmplusFakeInstruction) {
                return sjasmplusFakeInstruction;
            }
            const sjasmplusRegisterListInstruction =
                SjasmplusRegisterListInstructionParser.instance.parse(s, instructionSets);
            if (sjasmplusRegisterListInstruction) {
                return sjasmplusRegisterListInstruction;
            }
        }

        // Tries to parse user-defined macro
        const macro = MacroParser.instance.parse(s, instructionSets);
        if (macro) {
            return macro;
        }

        // Tries to parse assembly directives
        const assemblyDirective = AssemblyDirectiveParser.instance.parse(s);
        if (assemblyDirective) {
            return assemblyDirective;
        }

        // (could not parse raw instruction)
        return undefined;
    }
}
