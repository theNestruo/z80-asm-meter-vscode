import { MarkdownString, workspace } from 'vscode';
import Meterable from '../model/Meterable';
import AtExitDecorator from '../timing/modes/AtExitDecorator';
import { formatTiming } from '../utils/NumberUtils';
import FlowDecorator from '../timing/modes/FlowDecorator';
import { viewSize } from './ViewBytesUtils';

/**
 * Print human-readble information from a Meterable instance
 */
export default class MeterableViewer {

    // The MeterableCollection instance
    private metered: Meterable;

    // Configuration
    private platformConfiguration: string;
    private timingsHintsConfiguration: string;

    constructor(metered: Meterable) {

        this.metered = metered;

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");
        this.platformConfiguration = configuration.get("platform", "z80");
        this.timingsHintsConfiguration = configuration.get("timings.hints", "none");
    }

    getStatusBarTiming(): string | undefined {

        const text = this.getBasicTiming();
        if (this.platformConfiguration !== "pc8000") {
            return text;
        }

        const m1Text = formatTiming(this.metered.getMsxTiming());
        return `${text} / ${m1Text}`;
    }

    getCommandTiming(): string | undefined {

        const text = this.getStatusBarTiming();
        if (text === undefined) {
            return undefined;
        }

        // As text, with suffix
        return text + ((this.platformConfiguration === "cpc") ? " NOPs" : " clock cycles");
    }

    private getBasicTiming(): string | undefined {

        const timing = this.platformConfiguration === "msx" ? this.metered.getMsxTiming()
            : this.platformConfiguration === "cpc" ? this.metered.getCpcTiming()
                : this.metered.getZ80Timing();

        // (no data)
        if ((!timing)
            || (timing.length < 2)
            || ((timing[0] === 0) && (timing[1] === 0))) {
            return undefined;
        }

        // As text
        return formatTiming(timing);
    }

    getTooltip(): MarkdownString | undefined {

        const meterables = this.metered.getFlattenedMeterables();

        // (empty)
        if (!meterables.length) {
            return undefined;
        }

        const legend = this.metered instanceof AtExitDecorator ? "at exit"
            : this.metered instanceof FlowDecorator ? "execution flow"
                : "";
        const decoration = legend ? "<sup>*</sup>" : "";

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
        if (legend) {
            tooltip.appendMarkdown(`||<sup>*</sup>${legend}|\n`);
        }
        const sizeText = viewSize(this.metered);
        if (sizeText) {
            tooltip.appendMarkdown(`|**Size**|${sizeText}|\n\n`);
        }
        tooltip.appendMarkdown("---\n\n");

        // Tooltip: action
        const command = this.getCommand();
        tooltip.appendMarkdown(`Copy "${command}" to clipboard\n`);

        return tooltip;
    }

    getCommand(): string | undefined {

        const isTimingsHintsEnabled = ["subroutines", "any"].indexOf(this.timingsHintsConfiguration) !== -1;

        return isTimingsHintsEnabled
            ? this.getTimingHintsCommand()
            : this.getDefaultCommand();
    }

    private getDefaultCommand(): string | undefined {

        const timing = this.getCommandTiming();
        const size = viewSize(this.metered);

        return timing
            ? (size
                ? `${timing}, ${size}`
                : `${timing}`)
            : (size
                ? `${size}`
                : undefined);
    }

    private getTimingHintsCommand(): string | undefined {

        if (this.platformConfiguration === "msx") {
            const msxText = formatTiming(this.metered.getMsxTiming());
            return `[msx=${msxText}]`;
        }
        if (this.platformConfiguration === "cpc") {
            const cpcText = formatTiming(this.metered.getCpcTiming());
            return `[cpc=${cpcText}]`;
        }
        const z80text = formatTiming(this.metered.getZ80Timing());
        let text = `[z80=${z80text}]`;
        if (this.platformConfiguration === "pc8000") {
            const m1Text = formatTiming(this.metered.getMsxTiming());
            text += ` [m1=${m1Text}]`;
        }
        return text;
    }
}
