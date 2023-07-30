import { workspace } from 'vscode';
import Meterable from '../model/Meterable';
import MeterableCollection from '../model/MeterableCollection';
import MeterableRepetition from '../model/MeterableRepetition';
import { normalizeAndSplitQuotesAware } from '../utils/utils';
import NumericExpressionParser from "./NumericExpressionParser";
import AssemblyDirectiveParser from './directive/AssemblyDirectiveParser';
import MacroParser from './macro/MacroParser';
import SjasmplusFakeInstructionParser from './sjasmplus/SjasmplusFakeInstructionParser';
import SjasmplusRegisterListInstructionParser from './sjasmplus/SjasmplusRegisterListInstructionParser';
import Z80InstructionParser from './z80/Z80InstructionParser';
import SourceCodeLine from '../model/SourceCodeLine';
import SourceCodePart from '../model/SourceCodePart';
import SubroutineTimingHintDecorator from '../timing/SubroutineTimingHintDecorator';

export default class MainParser {

    // Configuration
    private platformConfiguration: string;
    private sjasmplusConfiguration: boolean;
    private syntaxLabelConfiguration: string;
    private syntaxLineSeparatorConfiguration: string;
    private syntaxRepeatConfiguration: string;
    private timingsHintsConfiguration: boolean;

    constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.sjasmplusConfiguration = configuration.get("sjasmplus", false);
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");
        this.syntaxRepeatConfiguration = configuration.get("syntax.repeat", "none");
        this.timingsHintsConfiguration = configuration.get("timings.hints", false);
    }

    parse(rawSourceCode: string | undefined): MeterableCollection {

        const meterables = new MeterableCollection();

        // (sanity checks)
        if (!rawSourceCode) {
            return meterables;
        }
        const rawSourceCodeLines = rawSourceCode.split(/[\r\n]+/);
        if (rawSourceCodeLines.length === 0) {
            return meterables;
        }
        if (rawSourceCodeLines[rawSourceCodeLines.length - 1].trim() === "") {
            rawSourceCodeLines.pop(); // (removes possible spurious empty line at the end of the selection)
        }

        // Determines syntax
        const labelRegExp = this.syntaxLabelConfiguration === "colonOptional"
                ? /(^[^\s:]+([\s:]|$))/
                : /(^\s*[^\s:]+:)/;
        const lineSeparator =
                this.syntaxLineSeparatorConfiguration === "colon" ? ":"
                : this.syntaxLineSeparatorConfiguration === "pipe" ? "|"
                : undefined;

        // Extracts the instructions for every line
        rawSourceCodeLines.forEach(rawSourceCodeLine => {
            const sourceCodeLines =
                    this.extractSourceCodeLinesFrom(rawSourceCodeLine, labelRegExp, lineSeparator);

            // Parses the instructions
            sourceCodeLines.getParts().forEach((sourceCodePart: SourceCodePart) => {
                meterables.add(this.parseSourceCodePart(sourceCodePart));
            });
        });

        return meterables;
    }

    private extractSourceCodeLinesFrom(
        rawSourceCodeLine: string, labelRegExp: RegExp,
        lineSeparator: string | undefined): SourceCodeLine {

        // Removes surrounding label and/or whitespace
        const cleanRawSourceCodeLine = rawSourceCodeLine.replace(labelRegExp, "").trim();

        // Splits the line and extracts trailing comment
        return normalizeAndSplitQuotesAware(cleanRawSourceCodeLine, lineSeparator);
    }

    private parseSourceCodePart(
            sourceCodePart: SourceCodePart): Meterable | undefined {

        const rawPart = sourceCodePart.getPart();
        const rawInstruction = this.extractRawInstruction(rawPart);
        var meterable = this.parseRawInstruction(rawInstruction);

        // Tries to parse timing hints from the comment
        if (this.timingsHintsConfiguration) {
            const rawComment = sourceCodePart.getComment();
            meterable = SubroutineTimingHintDecorator.of(meterable, rawComment);
        }

        // Tries to parse the optional repeat pseudo-op
        const repeatCount = this.extractRepeatCount(rawPart);
        return MeterableRepetition.of(meterable, repeatCount);
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

    private parseRawInstruction(s: string): Meterable | undefined {

        // Determines instruction sets
        const instructionSets =
            this.platformConfiguration === "z80n" ? [ "S", "N" ]
            : [ "S" ];

        // Tries to parse Z80 instructions
        const z80Instruction = Z80InstructionParser.instance.parseInstruction(s, instructionSets);
        if (!!z80Instruction) {
            return z80Instruction;
        }

        // Tries to parse sjasmplus alternative syntax and fake instructions
        if (this.sjasmplusConfiguration) {
            const sjasmplusFakeInstruction =
                    SjasmplusFakeInstructionParser.instance.parse(s, instructionSets);
            if (!!sjasmplusFakeInstruction) {
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
        if (!!macro) {
            return macro;
        }

        // Tries to parse assembly directives
        const assemblyDirective = AssemblyDirectiveParser.instance.parse(s);
        if (!!assemblyDirective) {
            return assemblyDirective;
        }

        // (could not parse raw instruction)
        return undefined;
    }

}
