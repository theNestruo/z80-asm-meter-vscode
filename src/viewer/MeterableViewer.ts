import { MarkdownString, workspace } from 'vscode';
import Meterable from '../model/Meterable';
import AtExitDecorator from '../timing/AtExitDecorator';
import { formatTiming } from '../utils/utils';

/**
 * Print human-readble information from a Meterable instance
 */
export default class MeterableViewer {

    // The MeterableCollection instance
    private metered: Meterable;

    // Configuration
    private platformConfiguration: string | undefined = undefined;

    constructor(metered: Meterable) {

        this.metered = metered;

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
    }

    getInstructionsAsText(): string | undefined {

        const queue = this.queue();
        const firstInstruction = this.firstInstruction(queue);

        // (empty)
        if (!firstInstruction) {
            return undefined;
        }

        const lastInstruction = this.lastInstruction(queue);
        let text = firstInstruction;
        if (lastInstruction) {
            if (queue.length) {
                text += " ...";
            }
            text += ` ${lastInstruction}`;
        }
        return text;
    }

    getTimingAsText(suffix: boolean): string | undefined {

        const timing = this.platformConfiguration === "msx" ? this.metered.getMsxTiming()
                : this.platformConfiguration === "cpc" ? this.metered.getCpcTiming()
                : this.metered.getZ80Timing();

        // (no data)
        if ((!timing)
                || (timing.length < 2)
                || ((timing[0] === 0) && (timing[1] === 0))) {
            return undefined;
        }

        let text = "";

        // Optional prefix (if decorated)
        if (!suffix) {
            const decorated = this.metered instanceof AtExitDecorator;
            if (decorated) {
                text += "$(debug-step-out)";
            }
        }

        // As text, with optional suffix
        text += formatTiming(timing);
        if (this.platformConfiguration === "pc8000") {
            const m1Text = formatTiming(this.metered.getMsxTiming());
            text += ` / ${m1Text}`;
        }
        if (suffix) {
            text += (this.platformConfiguration === "cpc") ? " NOPs" : " clock cycles";
        }
        return text;
    }

    getBytesAsText(): string | undefined {

        const queue = this.queue();
        const firstBytes = this.firstBytes(queue);

        // (empty)
        if (!firstBytes) {
            return undefined;
        }

        const lastBytes = this.lastBytes(queue);
        let text = firstBytes.join(" ");
        if (lastBytes) {
            if (queue.length) {
                text += " ...";
            }
            text += " " + lastBytes.join(" ");
        }
        return text;
    }

    getSizeAsText(): string | undefined {

        const size = this.metered.getSize();
        switch (size) {
            case 0: return undefined;
            case 1: return size + " byte";
            default: return size + " bytes";
        }
    }

    getDetailedMarkdownString(): MarkdownString | undefined {

        const meterables = this.metered.getFlattenedMeterables();

        // (empty)
        if (!meterables.length) {
            return undefined;
        }

        const decorated = this.metered instanceof AtExitDecorator;
        const decoration = decorated ? "<sup>*</sup>" : "";

        const tooltip = new MarkdownString();

        // Tooltip: Timing and size table
        tooltip.appendMarkdown("|||\n|---|---|\n");
        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.metered.getMsxTiming());
            tooltip.appendMarkdown(`|**MSX (Z80+M1)**|${msxText} clock cycles${decoration}|\n`);
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.metered.getCpcTiming());
            tooltip.appendMarkdown(`|**Amstrad CPC**|${cpcText} NOPs${decoration}|\n`);
        }
        const z80text = formatTiming(this.metered.getZ80Timing());
        tooltip.appendMarkdown(`|**Z80**|${z80text} clock cycles${decoration}|\n`);
        if (this.platformConfiguration === "pc8000") {
            const m1Text = formatTiming(this.metered.getMsxTiming());
            tooltip.appendMarkdown(`|**Z80+M1**|${m1Text} clock cycles${decoration}|\n`);
        }
        if (decorated) {
            tooltip.appendMarkdown("||<sup>*</sup>at exit|\n");
        }
        const sizeText = this.getSizeAsText();
        if (sizeText) {
            tooltip.appendMarkdown(`|**Size**|${sizeText}|\n\n`);
        }
        tooltip.appendMarkdown("---\n\n");

        // Tooltip: action
        const timingText = this.getTimingAsText(true);
        tooltip.appendMarkdown(!!timingText
                ? `Copy "${timingText}, ${sizeText}" to clipboard\n`
                : `Copy "${sizeText}" to clipboard\n`);

        return tooltip;
    }

    /**
     * @return the flattened array of the finer-grained meterables,
     * as a queue to be used in first*() and last*() methods
     */
    private queue(): Meterable[] {

        return this.metered.isComposed()
                ? [ ...this.metered.getFlattenedMeterables() ]
                : [ this.metered ];
    }

    private firstInstruction(queue: Meterable[]): string | undefined {

        while (queue.length) {
            const instruction = queue.shift()?.getInstruction();
            if (instruction) {
                return instruction;
            }
        }
        return undefined;
    }

    private lastInstruction(queue: Meterable[]): string | undefined {

        while (queue.length) {
            const instruction = queue.pop()?.getInstruction();
            if (instruction) {
                return instruction;
            }
        }
        return undefined;
    }

    private firstBytes(queue: Meterable[]): string[] | undefined {

        while (queue.length) {
            const bytes = queue.shift()?.getBytes();
            if (bytes && bytes.length) {
                return bytes;
            }
        }
        return undefined;
    }

    private lastBytes(queue: Meterable[]): string[] | undefined {

        while (queue.length) {
            const bytes = queue.pop()?.getBytes();
            if (bytes && bytes.length) {
                return bytes;
            }
        }
        return undefined;
    }
}
