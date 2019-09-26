import { Disposable, StatusBarItem, window, workspace } from 'vscode';
import { Z80Instruction } from "./z80Instruction";
import { Z80InstructionSet } from "./z80InstructionSet";
import { formatTiming, extractInstructionFrom } from './z80utils';

export class Z80MeterController {

    private z80InstructionSet: Z80InstructionSet;

    private _timingStatusBarItem: StatusBarItem | undefined;
    private _sizeStatusBarItem: StatusBarItem | undefined;
    private _disposable: Disposable;

	constructor() {
        this.z80InstructionSet = new Z80InstructionSet();

        this._onEvent();

        // subscribe to selection change and editor activation events
        let subscriptions: Disposable[] = [];
        window.onDidChangeTextEditorSelection(this._onEvent, this, subscriptions);
        window.onDidChangeActiveTextEditor(this._onEvent, this, subscriptions);

        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    private _onEvent() {

        const sourceCode = this.getSelectedSourceCode();
        const results = this.meterSourceCode(sourceCode || "");
        this.updateStatusBar(results);
    }

    private getSelectedSourceCode(): string | undefined {

        // Get the current text editor and selection
        const editor = window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        const editorSelection = editor.selection;
        if (editorSelection.isEmpty) {
            return undefined;
        }

        // Get selected source code only if it is a Z80 assembly file
        const editorDocument = editor.document;
        if ([
                "z80-asm-meter",
                "z80-macroasm",
                "z80-asm",
                "pasmo"
                ].indexOf(editorDocument.languageId) === -1) {
            return undefined;
        }
        return editorDocument.getText(editorSelection);
    }

    private meterSourceCode(sourceCode: string): Results {

        const results = new Results();

        const lines = sourceCode.split(/[\r\n]+/);
        if (lines.length === 0) {
            return results;
        }
        if (lines[lines.length - 1].trim() === "") {
            // (removes possible spurious empty line at the end of the selection)
            lines.pop();
        }

        const configuration = workspace.getConfiguration("z80-asm-meter");
        const maxLines: number | undefined = configuration.get("maxLines");
        if ((!!maxLines) && (lines.length > maxLines)) {
            // (disables if maximum lines exceeded)
            return results;
        }

        // For every line...
        const maxLoc: number | undefined = configuration.get("maxLoC");
        lines.forEach(rawLine => {
            // (stops after maximum loc count)
            if ((!!maxLoc) && (results.getLoc() >= maxLoc)) {
                return;
            }

            // Extracts the instruction
            const rawInstruction = extractInstructionFrom(rawLine);
            if (!rawInstruction) {
                return;
            }
            const instruction = this.z80InstructionSet.parseInstruction(rawInstruction);
            if (!instruction) {
                return;
            }

            results.addInstruction(instruction);
        });
        return results;
    }

    private updateStatusBar(results: Results) {

        const size = results.getSizeInformation();
        if (!size) {
            if (this._sizeStatusBarItem) {
                this._sizeStatusBarItem.hide();
            }

        } else {
            if (!this._sizeStatusBarItem) {
                this._sizeStatusBarItem = window.createStatusBarItem();
            }
            this._sizeStatusBarItem.text = "$(code) " + size["text"];
            this._sizeStatusBarItem.tooltip = size["tooltip"];
            this._sizeStatusBarItem.show();
        }

        const timing = results.getTimingInformation();
        if (!timing) {
            if (this._timingStatusBarItem) {
                this._timingStatusBarItem.hide();
            }

        } else {
            if (!this._timingStatusBarItem) {
                this._timingStatusBarItem = window.createStatusBarItem();
            }
            this._timingStatusBarItem.text = "$(watch) " + timing["text"];
            this._timingStatusBarItem.tooltip = timing["tooltip"];
            this._timingStatusBarItem.show();
        }
    }

	dispose() {
		this._disposable.dispose();
        if (this._timingStatusBarItem) {
            this._timingStatusBarItem.dispose();
            this._timingStatusBarItem = undefined;
        }
        if (this._sizeStatusBarItem) {
            this._sizeStatusBarItem.dispose();
            this._sizeStatusBarItem = undefined;
        }
	}
}

class Results {
    public z80Timing: number[] = [0, 0];
    public z80M1Timing: number[] = [0, 0];
    public cpcTiming: number[] = [0, 0];

    public size: number = 0;
    public loc: number = 0;

    public addInstruction(instruction: Z80Instruction) {
        const instructionZ80Timing = instruction.getZ80Timing();
        this.z80Timing[0] += instructionZ80Timing[0];
        this.z80Timing[1] += instructionZ80Timing[1];

        const instructionZ80M1Timing = instruction.getZ80M1Timing();
        this.z80M1Timing[0] += instructionZ80M1Timing[0];
        this.z80M1Timing[1] += instructionZ80M1Timing[1];

        const instructionCPCTiming = instruction.getCPCTiming();
        this.cpcTiming[0] += instructionCPCTiming[0];
        this.cpcTiming[1] += instructionCPCTiming[1];

        this.size += instruction.getSize();
        this.loc++;
    }

    public getTimingInformation(): Record<string, string | undefined> | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        // (disabled)
        const configuration: string = workspace.getConfiguration("z80-asm-meter").get("timing", "disabled");
        if (configuration === "disabled") {
            return undefined;
        }

        const z80text = formatTiming(this.z80Timing);
        const z80M1Text = formatTiming(this.z80M1Timing);
        const cpcText = formatTiming(this.cpcTiming);
        return {
            "text":
                configuration === "z80" ? z80text
                : configuration === "msx" ? z80M1Text
                : configuration === "both" ? z80text + " (" + z80M1Text + ")"
                : configuration === 'cpc' ? cpcText
                : undefined,
            "tooltip":
                `Timing Z80: ${z80text} clock cycles
                Timing Z80+M1: ${z80M1Text} clock cycles
                Timing CPC: ${cpcText} nops`
        };
    }

    public getSizeInformation(): Record<string, string | undefined> | undefined {

        // (empty)
        if (this.loc === 0) {
            return undefined;
        }

        // (disabled)
        const configuration: string = workspace.getConfiguration("z80-asm-meter").get("size", "disabled");
        if (configuration === "disabled") {
            return undefined;
        }

        const sizeText = this.size + (this.size === 1 ? " byte" : " bytes");
        const locText = this.loc + " LoC";
        return {
            "text":
                configuration === "bytecode" ? sizeText
                : configuration === "loc" ? locText
                : configuration === "both" ? sizeText + " (" + locText + ")"
                : undefined,
            "tooltip":
                sizeText + " in " + this.loc + " selected " + (this.loc === 1 ? "line" : "lines") + " of code (LoC)",
        };
    }

    public getLoc(): number {
        return this.loc;
    }
}
