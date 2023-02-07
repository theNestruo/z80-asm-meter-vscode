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

        // Determines instruction sets
        const instructionSets =
                this.platformConfiguration === "z80n" ? [ "S", "N" ]
                : [ "S" ];

        // Determines syntax
        const labelRegExp = this.syntaxLabelConfiguration === "default"
                ? /(^\s*[^\s:]+:)/
                : /(^[^\s:]+([\s:]|$))/;
        const commentRegExp = /((;|\/\/).*$)/;
        const lineSeparatorRegExp =
                this.syntaxLineSeparatorConfiguration === "colon" ? /\s*:\s*/
                : this.syntaxLineSeparatorConfiguration === "pipe" ? /\s*\|\s*/
                : undefined;
        const repeatRegExp =
                this.syntaxRepeatConfiguration == "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
                : this.syntaxRepeatConfiguration == "dot" ? /^(?:.(\S+)\s)(.+)$/
                : undefined;

        // For every line...
        rawLines.forEach(rawLine => {
            // Extracts the instructions
            const rawInstructions = extractRawInstructionsFrom(rawLine, labelRegExp, commentRegExp, lineSeparatorRegExp);
            if (!rawInstructions) {
                return;
            }
            rawInstructions.forEach((rawInstructionCandidate: string | undefined) => {

                // (sanity check)
                if (!rawInstructionCandidate) {
                    return;
                }

                // Tries to parse repeat pseudo-op
                const matches = repeatRegExp ? repeatRegExp.exec(rawInstructionCandidate) : null;
                const hasRepeatCount = matches && matches.length >= 1 && matches[1];
                const repeatCountCandidate = hasRepeatCount ? NumericExpressionParser.parse(matches[1]) : undefined;
                const repeatCount = repeatCountCandidate && repeatCountCandidate > 0 ? repeatCountCandidate : 1;
                const hasRepeatInstruction = matches && matches.length >= 2 && matches[2];
                const rawInstruction = hasRepeatInstruction ? matches[2] : rawInstructionCandidate;

                // Tries to parse Z80 instructions
                const z80Instruction = Z80InstructionParser.instance.parseInstruction(rawInstruction, instructionSets);
                if (z80Instruction) {
                    meterables.add(z80Instruction, repeatCount);
                    return;
                }

                // Tries to parse sjasmplus alternative syntax and fake instructions
                if (this.sjasmplus) {
                    const sjasmplusFakeInstruction = SjasmplusFakeInstructionParser.instance.parse(rawInstruction, instructionSets);
                    if (sjasmplusFakeInstruction) {
                        meterables.add(sjasmplusFakeInstruction, repeatCount);
                        return;
                    }

                    const sjasmplusRegisterListInstruction = SjasmplusRegisterListInstructionParser.instance.parse(rawInstruction, instructionSets);
                    if (sjasmplusRegisterListInstruction) {
                        meterables.add(sjasmplusRegisterListInstruction, repeatCount);
                        return;
                    }
                }

                // Tries to parse user-defined macro
                const macro = MacroParser.instance.parse(rawInstruction, instructionSets);
                if (macro) {
                    // const lInstructions = lMacro.getInstructions();
                    meterables.add(macro, repeatCount);
                    return;
                }

                // Tries to parse assembly directives
                const directive = AssemblyDirectiveParser.instance.parse(rawInstruction);
                if (directive) {
                    meterables.addAll(directive, repeatCount);
                    return;
                }
            });
        });

        return meterables;
    }
}

