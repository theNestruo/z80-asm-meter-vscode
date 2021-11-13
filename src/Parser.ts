import { workspace } from 'vscode';
import { AssemblyDirectiveParser } from './AssemblyDirectiveParser';
import { SjasmplusFakeInstructionParser } from './SjasmplusFakeInstructionParser';
import { extractRawInstructionsFrom } from './utils';
import { Z80Block } from './Z80Block';
import { Z80InstructionParser } from './Z80InstructionParser';

export class Parser {

    // Configuration
    private maxLines: number | undefined = undefined;
    private platformConfiguration: string | undefined = undefined;
    private syntaxLabelConfiguration: string | undefined = undefined;
    private syntaxLineSeparatorConfiguration: string | undefined = undefined;
    private sjasmFakeInstructionsConfiguration: boolean = false;

    constructor() {

        const configuration = workspace.getConfiguration("z80-asm-meter");

        // Saves configuration
        this.maxLines = configuration.get("maxLines");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");
        this.sjasmFakeInstructionsConfiguration = configuration.get("sjasmplusFakeInstructions") || false;
    }

    parse(sourceCode: string | undefined): Z80Block {

        const block = new Z80Block();

        if (!sourceCode) {
            return block;
        }
        const rawLines = sourceCode.split(/[\r\n]+/);
        if (rawLines.length === 0) {
            return block;
        }
        if (rawLines[rawLines.length - 1].trim() === "") {
            rawLines.pop(); // (removes possible spurious empty line at the end of the selection)
        }

        // (disables if maximum lines exceeded)
        if ((!!this.maxLines) && (rawLines.length > this.maxLines)) {
            return block;
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
        const lineSepartorRegExp =
                this.syntaxLineSeparatorConfiguration === "colon" ? /\s*:\s*/
                : this.syntaxLineSeparatorConfiguration === "pipe" ? /\s*\|\s*/
                : undefined;

        // For every line...
        rawLines.forEach(rawLine => {
            // Extracts the instructions
            const rawInstructions = extractRawInstructionsFrom(rawLine, labelRegExp, commentRegExp, lineSepartorRegExp);
            if (!rawInstructions) {
                return;
            }
            rawInstructions.forEach((rawInstruction: string | undefined) => {
                // Tries to parse Z80 instructions
                const lInstruction = Z80InstructionParser.instance.parseInstruction(rawInstruction, instructionSets);
                if (!!lInstruction) {
                    block.addInstructions([lInstruction]);
                    return;
                }
                // Tries to parse sjasmplus fake instructions
                if (this.sjasmFakeInstructionsConfiguration) {
                    const lInstructions = SjasmplusFakeInstructionParser.instance.parse(rawInstruction, instructionSets);
                    if (!!lInstructions) {
                        block.addInstructions(lInstructions);
                        return;
                    }
                }
                // Tries to parse assembly directives
                const lDirective = AssemblyDirectiveParser.instance.parse(rawInstruction);
                if (!!lDirective) {
                    block.addInstructions(lDirective);
                    return;
                }
            });
        });

        return block;
    }
}
