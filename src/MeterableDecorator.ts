import { MarkdownString, workspace } from 'vscode';
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

        const meterables = this.metered.getMeterables();

        // (empty)
        if (!meterables.length) {
            return undefined;
        }

        let text = meterables[0].getInstruction();
        if (meterables.length > 1) {
           text += " ...";
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

        const meterables = this.metered.getMeterables();

        // (empty)
        if (!meterables.length) {
            return undefined;
        }

        let allBytes: string[] = [];
        meterables.forEach(meterable => {
            allBytes.push(...meterable.getBytes());
        });
        let bytes: string[] = [], byteCount = 0;
        for (let i = 0, n = allBytes.length; i < n; i++) {
            const b = allBytes[i], bLenght = b.split(/\s+/).length;
            // (abbreviates beyond 8 bytes)
            if ((byteCount + bLenght >= 8) && (i < n - 1)) {
                bytes.push("...");
                bytes.push(allBytes[n - 1]);
                break;
            }
            bytes.push(b);
            byteCount += bLenght;
        }
        return bytes.join(" ");
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

        // Tooltip: Bytes (up to maxBytes bytes)
        // const n = this.maxBytesConfiguration ? Math.min(this.loc, this.maxBytesConfiguration) : this.loc;
        tooltip.appendMarkdown("|Instructions|Bytes|\n")
                .appendMarkdown("|---|---|\n");
        const lInstructions = this.getInstructionsAsText();
        const lBytes = this.getBytesAsText();
        // for (let i = 0; i < n; i++) {
        //     const bytes = lBytes[i];
        //     const instruction = lInstructions[i];
        //     tooltip.appendMarkdown(`|${instruction}|\`${bytes}\`|\n`);
        // }
        // if (this.maxBytesConfiguration && this.maxBytesConfiguration < this.loc) {
        //     const etc = this.loc - this.maxBytesConfiguration;
        //     tooltip.appendMarkdown(`|(+${etc} ${(etc === 1 ? "instruction" : "instructions")})|\`(...)\`|\n`);
        // }
        tooltip.appendMarkdown("\n")
                .appendMarkdown("---\n\n");

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
}
