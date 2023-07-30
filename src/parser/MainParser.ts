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

export default class MainParser {

    // Configuration
    private platformConfiguration: string;
    private sjasmplus: boolean;
    private syntaxLabelConfiguration: string;
    private syntaxLineSeparatorConfiguration: string;
    private syntaxRepeatConfiguration: string;

    constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.sjasmplus = configuration.get("sjasmplus", false);
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");
        this.syntaxRepeatConfiguration = configuration.get("syntax.repeat", "none");
    }

    parse(sourceCode: string | undefined): MeterableCollection {

        const meterables = new MeterableCollection();

        // (sanity checks)
        if (!sourceCode) {
            return meterables;
        }
        const rawLines = sourceCode.split(/[\r\n]+/);
        if (rawLines.length === 0) {
            return meterables;
        }
        if (rawLines[rawLines.length - 1].trim() === "") {
            rawLines.pop(); // (removes possible spurious empty line at the end of the selection)
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
        rawLines.forEach(rawLine => {
            const rawInstructionCandidates =
                    this.extractRawInstructionCandidatesFrom(rawLine, labelRegExp, lineSeparator);

            // Parses the instructions
            rawInstructionCandidates?.forEach((rawInstructionCandidate: string | undefined) => {
                meterables.add(this.parseRawInstructionCandidate(rawInstructionCandidate));
            });
        });

        return meterables;
    }

    private extractRawInstructionCandidatesFrom(
        rawLine: string, labelRegExp: RegExp,
        lineSeparator: string | undefined): string[] | undefined {

        // Removes surrounding label and/or whitespace
        const rawParts = rawLine.replace(labelRegExp, "").trim();

        // For every part of the line
        const rawInstructionCandidates: string[] = [];
        normalizeAndSplitQuotesAware(rawParts, lineSeparator).forEach(part => {
            if (part.length !== 0) {
                rawInstructionCandidates.push(part);
            }
        });

        return rawInstructionCandidates.length === 0 ? undefined : rawInstructionCandidates;
    }

    private parseRawInstructionCandidate(
            rawInstructionCandidate: string | undefined): Meterable | undefined {

        // (sanity check)
        if (!rawInstructionCandidate) {
            return undefined;
        }

        // Tries to parse the optional repeat pseudo-op
        const repeatCount = this.extractRepeatCount(rawInstructionCandidate);
        const rawInstruction = this.extractRawInstruction(rawInstructionCandidate);
        return MeterableRepetition.of(this.parseRawInstruction(rawInstruction), repeatCount);
    }

    private extractRepeatCount(rawInstructionCandidate: string): number {

        // Determines syntax
        const repeatRegExp =
            this.syntaxRepeatConfiguration === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
            : this.syntaxRepeatConfiguration === "dot" ? /^(?:\.(\S+)\s)(.+)$/
            : undefined;
        if (!repeatRegExp) {
            return 1;
        }

        // Tries to parse repeat pseudo-op
        const matches = repeatRegExp.exec(rawInstructionCandidate);
        const hasRepeatCount = matches && matches.length >= 1 && matches[1];
        if (!hasRepeatCount) {
            return 1;
        }
        const repeatCountCandidate = NumericExpressionParser.parse(matches[1]);
        return repeatCountCandidate && repeatCountCandidate > 0 ? repeatCountCandidate : 1;
    }

    private extractRawInstruction(rawInstructionCandidate: string): string {

        // Determines syntax
        const repeatRegExp =
            this.syntaxRepeatConfiguration === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
            : this.syntaxRepeatConfiguration === "dot" ? /^(?:\.(\S+)\s)(.+)$/
            : undefined;
        if (!repeatRegExp) {
            return rawInstructionCandidate;
        }

        // Tries to parse beyond the repeat pseudo-op
        const matches = repeatRegExp.exec(rawInstructionCandidate);
        const hasRepeatInstruction = matches && matches.length >= 2 && matches[2];
        return hasRepeatInstruction ? matches[2] : rawInstructionCandidate;
    }

    private parseRawInstruction(rawInstruction: string): Meterable | undefined {

        // Determines instruction sets
        const instructionSets =
            this.platformConfiguration === "z80n" ? [ "S", "N" ]
            : [ "S" ];

        // Tries to parse Z80 instructions
        const z80Instruction = Z80InstructionParser.instance.parseInstruction(rawInstruction, instructionSets);
        if (!!z80Instruction) {
            return z80Instruction;
        }

        // Tries to parse sjasmplus alternative syntax and fake instructions
        if (this.sjasmplus) {
            const sjasmplusFakeInstruction =
                    SjasmplusFakeInstructionParser.instance.parse(rawInstruction, instructionSets);
            if (!!sjasmplusFakeInstruction) {
                return sjasmplusFakeInstruction;
            }
            const sjasmplusRegisterListInstruction =
                    SjasmplusRegisterListInstructionParser.instance.parse(rawInstruction, instructionSets);
            if (sjasmplusRegisterListInstruction) {
                return sjasmplusRegisterListInstruction;
            }
        }

        // Tries to parse user-defined macro
        const macro = MacroParser.instance.parse(rawInstruction, instructionSets);
        if (!!macro) {
            return macro;
        }

        // Tries to parse assembly directives
        const assemblyDirective = AssemblyDirectiveParser.instance.parse(rawInstruction);
        if (!!assemblyDirective) {
            return assemblyDirective;
        }

        // (could not parse raw instruction)
        return undefined;
    }

}

