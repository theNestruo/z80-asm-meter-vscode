import { workspace } from 'vscode';
import { Z80Instruction } from "./z80Instruction";
import { Z80InstructionSet } from './z80InstructionSet';
import { formatTiming, extractInstructionsFrom } from './z80Utils';

export class Z80Block {

    // Configuration
    private maxOpcodesConfiguration: number | undefined = undefined;
    private platformConfiguration: string | undefined = undefined;
    private syntaxLabelConfiguration: string | undefined = undefined;
    private viewBytecodeSizeConfiguration: boolean | undefined = undefined;
    private viewInstructionConfiguration: boolean | undefined = undefined;
    private viewLoCConfiguration: boolean | undefined = undefined;
    private viewOpcodeConfiguration: boolean | undefined = undefined;

    // Timing information
    public z80Timing: number[] = [0, 0];
    public msxTiming: number[] = [0, 0];
    public cpcTiming: number[] = [0, 0];

    // Size information
    public size: number = 0;
    public loc: number = 0;
    public instructions: string[] = [];
    public opcodes: string[] = [];

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
        this.maxOpcodesConfiguration = parseInt(configuration.get("maxOpcodes") || "");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.syntaxLabelConfiguration = configuration.get("syntax.label", "default");
        this.viewBytecodeSizeConfiguration = configuration.get("viewBytecodeSize") || false;
        this.viewInstructionConfiguration = configuration.get("viewInstruction") || false;
        this.viewLoCConfiguration = configuration.get("viewLoC") || false;
        this.viewOpcodeConfiguration = configuration.get("viewOpcode") || false;

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
            const rawInstructions = extractInstructionsFrom(rawLine, labelRegExp, commentRegExp);
            if (!rawInstructions) {
                return;
            }
            rawInstructions.forEach((rawInstruction: string | undefined) => {
                const instruction = Z80InstructionSet.instance.parseInstruction(rawInstruction, instructionSets);
                this.addInstruction(instruction);
            });

            // (stops after maximum loc count)
            if ((!!maxLoc) && (this.loc >= maxLoc)) {
                return;
            }
        });
    }

    public addInstruction(instruction: Z80Instruction | undefined) {

        if (!instruction) {
            return;
        }

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
        this.opcodes.push(instruction.getOpcode());

        this.size += instruction.getSize();
        this.loc++;
    }

    public getInstructionInformation(): Record<string, string | undefined> | undefined {

        // (empty or disabled)
        if ((this.loc === 0)
                || (!this.viewInstructionConfiguration
                    && !this.viewLoCConfiguration)) {
            return undefined;
        }

        // text: first instruction and LoC
        const locText = this.loc + " LoC";
        let text = "";
        if (this.viewInstructionConfiguration) {
            // text: only the first instruction
            text = this.instructions[0];
            if (this.loc > 1) {
                text += " ...";
            }
            if (this.viewLoCConfiguration && (this.loc > 1)) {
                text += ` (${locText})`;
            }
        } else {
            text = locText;
        }

        // tooltip: up to maxOpcodes instructions
        const n = this.maxOpcodesConfiguration ? Math.min(this.loc, this.maxOpcodesConfiguration) : this.loc;
        let tooltip = this.loc + " selected " + (this.loc === 1 ? "line" : "lines") + " of code (LoC):";
        for (let i = 0; i < n; i++) {
            const opcode = this.opcodes[i];
            const instruction = this.instructions[i];
            tooltip += "\n    " + instruction;
        }
        if (this.maxOpcodesConfiguration && this.maxOpcodesConfiguration < this.loc) {
            const etc = this.loc - this.maxOpcodesConfiguration;
            tooltip += "\n(and " + etc + " more " + (etc === 1 ? "instruction" : "instructions") + ")";
        }

        return {
            "text": text,
            "tooltip": tooltip
        };
    }

    public getTimingInformation(): Record<string, string | undefined> | undefined {

        // (empty or disabled)
        if (this.loc === 0) {
            return undefined;
        }

        const z80text = formatTiming(this.z80Timing);
        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.msxTiming);
            return {
                "text": msxText,
                "textDetail": `${msxText} clock cycles`,
                "tooltip":
                    `MSX (Z80+M1): ${msxText} clock cycles\n`
                    + `Z80: ${z80text} clock cycles`
            };
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.cpcTiming);
            return {
                "text": cpcText,
                "textDetail": `${cpcText} NOPs`,
                "tooltip":
                    `Amstrad CPC: ${cpcText} NOPs\n`
                    + `Z80: ${z80text} clock cycles`
            };
        }
        return {
            "text": z80text,
            "textDetail": `${z80text} clock cycles`,
            "tooltip": `Z80: ${z80text} clock cycles`
        };
    }

    public getOpcodeAndSizeInformation(): Record<string, string | undefined> | undefined {

        // (empty or disabled)
        if ((this.loc === 0)
                || (!this.viewBytecodeSizeConfiguration
                    && !this.viewOpcodeConfiguration)) {
            return undefined;
        }

        // text: first opcode and bytesize
        const sizeText = this.size + (this.size === 1 ? " byte" : " bytes");
        let text = "";
        if (this.viewOpcodeConfiguration) {
            // text: only the first opcode
            text = this.opcodes[0];
            if (this.loc > 1) {
                text += " ...";
            }
            if (this.viewBytecodeSizeConfiguration) {
                text += ` (${sizeText})`;
            }
        } else {
            text = sizeText;
        }

        // tooltip: up to maxOpcodes opcodes
        const n = this.maxOpcodesConfiguration ? Math.min(this.loc, this.maxOpcodesConfiguration) : this.loc;
        let tooltip = "Opcodes:";
        for (let i = 0; i < n; i++) {
            const opcode = this.opcodes[i];
            const instruction = this.instructions[i];
            tooltip += `\n    ${opcode}    ; ${instruction}`;
        }
        if (this.maxOpcodesConfiguration && this.maxOpcodesConfiguration < this.loc) {
            const etc = this.loc - this.maxOpcodesConfiguration;
            tooltip += "\n(and " + etc + " more " + (etc === 1 ? "instruction" : "instructions") + ")";
        }

        return {
            "text": text,
            "textDetail": sizeText,
            "tooltip": tooltip
        };
    }
}
