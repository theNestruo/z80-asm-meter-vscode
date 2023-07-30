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
        const firstMeterable = this.next(queue);

        // (empty)
        if (!firstMeterable) {
            return undefined;
        }

        const lastMeterable = this.last(queue);
        let text = firstMeterable.getInstruction();
        if (lastMeterable) {
            if (queue.length) {
                text += " ...";
            }
            text += " " + lastMeterable.getInstruction();
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

        const decorated = this.metered instanceof AtExitDecorator;

        // As text, with optional suffix
        let text = formatTiming(timing);
        if (this.platformConfiguration === "pc8000") {
            const m1Text = formatTiming(this.metered.getMsxTiming());
            text += ` / ${m1Text}`;
        }
        if (suffix) {
            text += (this.platformConfiguration === "cpc") ? " NOPs" : " clock cycles";
        }
        if (decorated) {
            text += "*";
        }
        return text;
    }

    getBytesAsText(): string | undefined {

        const queue = this.queue();
        const firstMeterable = this.next(queue);

        // (empty)
        if (!firstMeterable) {
            return undefined;
        }

        const lastMeterable = this.last(queue);
        let text = firstMeterable.getBytes().join(" ");
        if (lastMeterable) {
            if (queue.length) {
                text += " ...";
            }
            text += " " + lastMeterable.getBytes().join(" ");
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

        const meterables = this.metered.decompose();

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
     * The MeterableCollection instance, as a queue to be used in next() and last() methods
     */
    private queue(): Meterable[] {

        return this.metered.isComposed()
                ? [ ...this.metered.decompose() ]
                : [ this.metered ];
    }

    /**
     * Advances the meterable collection from the start, unnesting the meterables if possible
     * @return the next unaggregated Meterable in the collection
     */
    private next(queue: Meterable[]): Meterable | undefined {

        return queue?.shift();
    }

    /**
     * Advances the meterable collection from the end, unnesting the meterables if possible
     * @return the last unaggregated Meterable in the collection
     */
     private last(queue: Meterable[]): Meterable | undefined {

        return queue?.pop();
    }
}
