import { MarkdownString, workspace } from 'vscode';
import { Z80AbstractInstruction } from './z80AbstractInstruction';
import { Z80InstructionSet } from './z80InstructionSet';
import { extractRawInstructionsFrom, formatTiming } from './z80Utils';

export class Z80Block {

    // Configuration
    private maxBytesConfiguration: number | undefined = undefined;
    private platformConfiguration: string | undefined = undefined;
    private syntaxLabelConfiguration: string | undefined = undefined;
    private syntaxLineSeparatorConfiguration: string | undefined = undefined;

    // Timing information
    public z80Timing: number[] = [0, 0];
    public msxTiming: number[] = [0, 0];
    public cpcTiming: number[] = [0, 0];

    // Size information
    public size: number = 0;
    public loc: number = 0;

    // Intructions and bytes
    public instructions: string[] = [];
    public bytes: string[] = [];

    constructor(sourceCode: string | undefined) {

        if (!sourceCode) {
            return;
        }
        const rawLines = sourceCode.split(/[\r\n]+/);
        if (rawLines.length === 0) {
            return;
        }
        if (rawLines[rawLines.length - 1].trim() === "") {
            rawLines.pop(); // (removes possible spurious empty line at the end of the selection)
        }

        const configuration = workspace.getConfiguration("z80-asm-meter");

        // (disables if maximum lines exceeded)
        const maxLines: number | undefined = configuration.get("maxLines");
        if ((!!maxLines) && (rawLines.length > maxLines)) {
            return;
        }

        // Saves configuration
        this.maxBytesConfiguration = parseInt(configuration.get("maxBytes") || configuration.get("maxOpcodes") || "");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.syntaxLineSeparatorConfiguration = configuration.get("syntax.lineSeparator", "none");

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
        const maxLoc: number | undefined = configuration.get("maxLoC");
        rawLines.forEach(rawLine => {
            // Extracts the instructions
            const rawInstructions = extractRawInstructionsFrom(rawLine, labelRegExp, commentRegExp, lineSepartorRegExp);
            if (!rawInstructions) {
                return;
            }
            rawInstructions.forEach((rawInstruction: string | undefined) => {
                const lInstructions = Z80InstructionSet.instance.parseInstructions(rawInstruction, instructionSets);
                this.addInstructions(lInstructions);
            });

            // (stops after maximum loc count)
            if ((!!maxLoc) && (this.loc >= maxLoc)) {
                return;
            }
        });
    }

    private addInstructions(instructions: Z80AbstractInstruction[] | undefined) {

        if (!instructions) {
            return;
        }

        instructions.forEach((instruction : Z80AbstractInstruction) => {
            this.addInstruction(instruction);
        });
    }

    private addInstruction(instruction: Z80AbstractInstruction) {

        const instructionZ80Timing = instruction.getZ80Timing();
        this.z80Timing[0] += instructionZ80Timing[0];
        this.z80Timing[1] += instructionZ80Timing[1];

        const instructionMsxTiming = instruction.getMsxTiming();
        this.msxTiming[0] += instructionMsxTiming[0];
        this.msxTiming[1] += instructionMsxTiming[1];

        const instructionCpcTiming = instruction.getCpcTiming();
        this.cpcTiming[0] += instructionCpcTiming[0];
        this.cpcTiming[1] += instructionCpcTiming[1];

        this.instructions.push(instruction.getInstruction());
        this.bytes.push(instruction.getBytes());

        this.size += instruction.getSize();
        this.loc++;
    }

    public getInstructionText(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        let text = this.instructions[0];
        if (this.loc > 1) {
            text += " ...";
        }
        return text;
    }

    public getTimingText(suffix: boolean): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        if (suffix) {
            switch (this.platformConfiguration) {
                case "msx":
                    return formatTiming(this.msxTiming) + " clock cycles";
                case "cpc":
                    return formatTiming(this.cpcTiming) + " NOPs";
                default:
                    return formatTiming(this.z80Timing) + " clock cycles";
            }
        } else {
            switch (this.platformConfiguration) {
                case "msx":
                    return formatTiming(this.msxTiming);
                case "cpc":
                    return formatTiming(this.cpcTiming);
                default:
                    return formatTiming(this.z80Timing);
            }
        }
    }

    public getSizeText(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        return this.size + (this.size === 1 ? " byte" : " bytes");
    }

    public getBytesText(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        let text = this.bytes[0];
        if (this.loc > 1) {
            text += " ...";
        }
        return text;
    }

    public getDetailedMarkdownString(): MarkdownString | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        const tooltip = new MarkdownString();

        // Tooltip: Bytes (up to maxBytes bytes)
        const n = this.maxBytesConfiguration ? Math.min(this.loc, this.maxBytesConfiguration) : this.loc;
        tooltip.appendMarkdown("|Instructions|Bytes|\n")
                .appendMarkdown("|---|---|\n");
        for (let i = 0; i < n; i++) {
            const bytes = this.bytes[i];
            const instruction = this.instructions[i];
            tooltip.appendMarkdown(`|${instruction}|\`${bytes}\`|\n`);
        }
        if (this.maxBytesConfiguration && this.maxBytesConfiguration < this.loc) {
            const etc = this.loc - this.maxBytesConfiguration;
            tooltip.appendMarkdown(`|(+${etc} ${(etc === 1 ? "instruction" : "instructions")})|\`(...)\`|\n`);
        }
        tooltip.appendMarkdown("\n")
                .appendMarkdown("---\n\n");

        // Tooltip: Timing and size table
        tooltip.appendMarkdown("|||\n|---|---|\n");
        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.msxTiming);
            tooltip.appendMarkdown(`|**MSX (Z80+M1)**|${msxText} clock cycles|\n`);
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.cpcTiming);
            tooltip.appendMarkdown(`|**Amstrad CPC**|${cpcText} NOPs|\n`);
        }
        const z80text = formatTiming(this.z80Timing);
        const sizeText = this.size + (this.size === 1 ? " byte" : " bytes");
        tooltip.appendMarkdown(`|**Z80**|${z80text} clock cycles|\n`)
                .appendMarkdown(`|**Size**|${sizeText}|\n\n`)
                .appendMarkdown("---\n\n");

        // Tooltip: action
        const timingText = this.getTimingText(true);
        tooltip.appendMarkdown(`Copy "${timingText}, ${sizeText}" to clipboard\n`);

        return tooltip;
    }
}
