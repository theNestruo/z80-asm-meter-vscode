import { MarkdownString, workspace } from 'vscode';
import { Meterable } from './Meterable';
import { MeterableCollection } from './MeterableCollection';
import { formatTiming } from './utils';

/**
 * Decorates a MeterableCollection instance to print human-readble information
 */
export class MeterableDecorator {

    // The MeterableCollection instance
    private metered: MeterableCollection;

    // Configuration
    private platformConfiguration: string | undefined = undefined;

    constructor(metered: MeterableCollection) {

        this.metered = metered;

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
    }

    public getInstructionsAsText(): string | undefined {

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

    public getTimingAsText(suffix: boolean): string | undefined {

        const timing = this.platformConfiguration === "msx" ? this.metered.getMsxTiming()
                : this.platformConfiguration === "cpc" ? this.metered.getCpcTiming()
                : this.metered.getZ80Timing();

        // (no data)
        if ((!timing)
                || (timing.length < 2)
                || ((timing[0] === 0) && (timing[1] === 0))) {
            return undefined;
        }

        // As text, with optional suffix
        let text = formatTiming(timing);
        if (suffix) {
            text += (this.platformConfiguration === "cpc") ? " NOPs" : " clock cycles";
        }
        return text;
    }

    public getBytesAsText(): string | undefined {

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

    public getSizeAsText(): string | undefined {

        const size = this.metered.getSize();
        switch (size) {
            case 0: return undefined;
            case 1: return size + " byte";
            default: return size + " bytes";
        }
    }

    public getDetailedMarkdownString(): MarkdownString | undefined {

        const meterables = this.metered.getMeterables();

        // (empty)
        if (!meterables.length) {
            return undefined;
        }

        const tooltip = new MarkdownString();

        // Tooltip: Timing and size table
        tooltip.appendMarkdown("|||\n|---|---|\n");
        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.metered.getMsxTiming());
            tooltip.appendMarkdown(`|**MSX (Z80+M1)**|${msxText} clock cycles|\n`);
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.metered.getCpcTiming());
            tooltip.appendMarkdown(`|**Amstrad CPC**|${cpcText} NOPs|\n`);
        }
        const z80text = formatTiming(this.metered.getZ80Timing());
        tooltip.appendMarkdown(`|**Z80**|${z80text} clock cycles|\n`);

        const sizeText = this.getSizeAsText();
        if (sizeText) {
            tooltip.appendMarkdown(`|**Size**|${sizeText}|\n\n`);
        }
        tooltip.appendMarkdown("---\n\n");

        // Tooltip: action
        const timingText = this.getTimingAsText(true);
        tooltip.appendMarkdown(`Copy "${timingText}, ${sizeText}" to clipboard\n`);

        return tooltip;
    }

    /**
     * The MeterableCollection instance, as a queue to be used in next() and last() methods
     */
     private queue(): Meterable[] {

        return [this.metered];
    }

    /**
     * Advances the meterable collection from the start, unnesting the meterables if possible
     * @return the next unaggregated Meterable in the collection
     */
    private next(queue: Meterable[]): Meterable | undefined {

        if (!queue) {
            return undefined;
        }
        const meterable = queue.shift();
        if ((meterable instanceof MeterableCollection) && (!meterable.getInstruction())) {
            queue.unshift(...meterable.getMeterables());
            return this.next(queue);
        }
        return meterable;
    }

    /**
     * Advances the meterable collection from the end, unnesting the meterables if possible
     * @return the last unaggregated Meterable in the collection
     */
     private last(queue: Meterable[]): Meterable | undefined {

        if (!queue) {
            return undefined;
        }
        const meterable = queue.pop();
        if ((meterable instanceof MeterableCollection) && (!meterable.getInstruction())) {
            queue.unshift(...meterable.getMeterables());
            return this.last(queue);
        }
        return meterable;
    }
}
