import { workspace } from 'vscode';
import { AssemblyDirectiveParser } from './AssemblyDirectiveParser';
import { MacroParser } from './MacroParser';
import { MeterableCollection } from './MeterableCollection';
import { NumericExpressionParser } from "./NumericExpressionParser";
import { SjasmplusFakeInstructionParser } from './SjasmplusFakeInstructionParser';
import { SjasmplusRegisterListInstructionParser } from './SjasmplusRegisterListInstructionParser';
import { extractRawInstructionsFrom } from './utils';
import { Z80InstructionParser } from './Z80InstructionParser';

export class MainParser {

    // Configuration
    private platformConfiguration: string;
    private syntaxLabelConfiguration: string;
    private syntaxLineSeparatorConfiguration: string;
    private syntaxRepeatConfiguration: string;
    private sjasmplus: boolean;

    constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");
        this.syntaxRepeatConfiguration = configuration.get("syntax.repeat", "none");
        this.sjasmplus = configuration.get("sjasmplus", false);
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
        const labelRegExp = this.syntaxLabelConfiguration === "default"
                ? /(^\s*[^\s:]+:)/
                : /(^[^\s:]+([\s:]|$))/;
        const commentRegExp = /((;|\/\/).*$)/;
        const lineSeparator =
                this.syntaxLineSeparatorConfiguration === "colon" ? ":"
                : this.syntaxLineSeparatorConfiguration === "pipe" ? "|"
                : undefined;

        // Extracts the instructions for every line
        rawLines.forEach(rawLine => {
            const rawInstructions = extractRawInstructionsFrom(rawLine, labelRegExp, commentRegExp, lineSeparator);
            if (!rawInstructions) {
                return;
            }

            // Parses the instructions
            rawInstructions.forEach((rawInstructionCandidate: string | undefined) => {
                this.parseRawInstructionCandidateAndAddTo(rawInstructionCandidate, meterables);
            });
        });

        return meterables;
    }

    private parseRawInstructionCandidateAndAddTo(
            rawInstructionCandidate: string | undefined, meterables: MeterableCollection) {

        // (sanity check)
        if (!rawInstructionCandidate) {
            return;
        }

        // Tries to parse repeat pseudo-op
        const repeatCount = this.extractRepeatCount(rawInstructionCandidate);
        const rawInstruction = this.extractRawInstruction(rawInstructionCandidate);

        // Determines instruction sets
        const instructionSets =
            this.platformConfiguration === "z80n" ? [ "S", "N" ]
            : [ "S" ];

        // Tries to parse Z80 instructions
        if (meterables.add(
            Z80InstructionParser.instance.parseInstruction(rawInstruction, instructionSets), repeatCount)) {
            return;
        }

        // Tries to parse sjasmplus alternative syntax and fake instructions
        if (this.sjasmplus) {
            if (meterables.add(
                    SjasmplusFakeInstructionParser.instance.parse(rawInstruction, instructionSets),
                    repeatCount)
                || meterables.add(
                    SjasmplusRegisterListInstructionParser.instance.parse(rawInstruction, instructionSets),
                    repeatCount)) {
                return;
            }
        }

        // Tries to parse user-defined macro
        if (meterables.add(MacroParser.instance.parse(rawInstruction, instructionSets), repeatCount)) {
            return;
        }

        // Tries to parse assembly directives
        if (meterables.addAll(AssemblyDirectiveParser.instance.parse(rawInstruction), repeatCount)) {
            return;
        }

        // (could not parse raw instruction)
    }

    private extractRepeatCount(rawInstructionCandidate: string): number {

        // Determines syntax
        const repeatRegExp =
            this.syntaxRepeatConfiguration == "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
            : this.syntaxRepeatConfiguration == "dot" ? /^(?:\.(\S+)\s)(.+)$/
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
            this.syntaxRepeatConfiguration == "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
            : this.syntaxRepeatConfiguration == "dot" ? /^(?:\.(\S+)\s)(.+)$/
            : undefined;
        if (!repeatRegExp) {
            return rawInstructionCandidate;
        }

        // Tries to parse beyond the repeat pseudo-op
        const matches = repeatRegExp.exec(rawInstructionCandidate);
        const hasRepeatInstruction = matches && matches.length >= 2 && matches[2];
        return hasRepeatInstruction ? matches[2] : rawInstructionCandidate;
    }
}

