import { workspace } from 'vscode';
import { Z80AbstractInstruction } from './z80AbstractInstruction';
import { Z80InstructionSet } from './z80InstructionSet';
import { extractRawInstructionsFrom, formatTiming } from './z80Utils';

export class Z80Block {

    // Configuration
    private maxBytesConfiguration: number | undefined = undefined;
    private platformConfiguration: string | undefined = undefined;
    private syntaxLabelConfiguration: string | undefined = undefined;

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

        // Determines instruction sets
        const instructionSets =
                this.platformConfiguration === "z80n" ? [ "S", "N" ]
                : [ "S" ];

        // Determines syntax
        const labelRegExp = this.syntaxLabelConfiguration === "default"
                ? /(^\s*[^\s:]+:)/
                : /(^[^\s:]+([\s:]|$))/;
        const commentRegExp = /((;|\/\/).*$)/;

        // For every line...
        const maxLoc: number | undefined = configuration.get("maxLoC");
        rawLines.forEach(rawLine => {
            // Extracts the instructions
            const rawInstructions = extractRawInstructionsFrom(rawLine, labelRegExp, commentRegExp);
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

    private addInstructions(pInstructions: Z80AbstractInstruction[] | undefined) {

        if (!pInstructions) {
            return;
        }

        pInstructions.forEach((instruction : Z80AbstractInstruction) => {
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

    public getTiming(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        switch (this.platformConfiguration) {
            case "msx":
                return formatTiming(this.msxTiming);
            case "cpc":
                return formatTiming(this.cpcTiming);
            default:
                return formatTiming(this.z80Timing);
        }
    }

    public getTimingString(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        switch (this.platformConfiguration) {
            case "msx":
                return formatTiming(this.msxTiming) + " clock cycles";
            case "cpc":
                return formatTiming(this.cpcTiming) + " NOPs";
            default:
                return formatTiming(this.z80Timing) + " clock cycles";
        }
    }

    public getTimingDetailedString(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        const z80text = formatTiming(this.z80Timing);
        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.msxTiming);
            return `MSX (Z80+M1): ${msxText} clock cycles\n`
                    + `Z80: ${z80text} clock cycles`;
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.cpcTiming);
            return `Amstrad CPC: ${cpcText} NOPs\n`
                    + `Z80: ${z80text} clock cycles`;
        }
        return `Z80: ${z80text} clock cycles`;
    }

    public getSizeString(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        return this.size + (this.size === 1 ? " byte" : " bytes");
    }

    public getInstructionString(): string | undefined {

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

    public getBytesString(): string | undefined {

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

    public getInstructionAndBytesDetailedString(): string | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        // tooltip: up to maxBytes bytes
        const n = this.maxBytesConfiguration ? Math.min(this.loc, this.maxBytesConfiguration) : this.loc;
        let text = "";
        for (let i = 0; i < n; i++) {
            const bytes = this.bytes[i];
            const instruction = this.instructions[i];
            if (i !== 0) {
                text += '\n';
            }
            text += `  ${bytes}    ; ${instruction}`;
        }
        if (this.maxBytesConfiguration && this.maxBytesConfiguration < this.loc) {
            const etc = this.loc - this.maxBytesConfiguration;
            text += "\n  (and " + etc + " more " + (etc === 1 ? "instruction" : "instructions") + ")";
        }

        return text;
    }
}
