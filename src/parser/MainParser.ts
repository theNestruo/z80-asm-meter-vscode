import { workspace } from 'vscode';
import Meterable from '../model/Meterable';
import MeterableCollection from '../model/MeterableCollection';
import MeterableHint from '../model/MeterableHint';
import MeterableRepetition from '../model/MeterableRepetition';
import SourceCodePart from '../model/SourceCodePart';
import TimingHintDecorator from '../timing/TimingHintDecorator';
import { normalizeAndSplitQuotesAware } from '../utils/utils';
import NumericExpressionParser from "./NumericExpressionParser";
import AssemblyDirectiveParser from './directive/AssemblyDirectiveParser';
import GlassReptParser from './glass/GlassReptParser';
import MacroParser from './macro/MacroParser';
import SjasmplusDupParser from './sjasmplus/SjasmplusDupParser';
import SjasmplusFakeInstructionParser from './sjasmplus/SjasmplusFakeInstructionParser';
import SjasmplusRegisterListInstructionParser from './sjasmplus/SjasmplusRegisterListInstructionParser';
import Z80InstructionParser from './z80/Z80InstructionParser';
import GlassFakeInstructionParser from './glass/GlassFakeInstructionParser';

export default class MainParser {

    // Configuration
    private instructionSets: string[];
    private syntaxConfiguration: string;
    private labelRegExp: RegExp;
    private lineSeparator: string | undefined;
    private repeatRegExp: RegExp | undefined;
    private timingsHintsConfiguration: string;

    constructor() {

        // Saves configuration
        const configuration = workspace.getConfiguration("z80-asm-meter");

        const platformConfiguration: string = configuration.get("platform", "z80");
        this.instructionSets = platformConfiguration === "z80n"
            ? ["S", "N"]
            : ["S"];

        this.syntaxConfiguration = configuration.get("syntax",
            configuration.get("sjasmplus", false) ? "sjasmplus" : "default");

        const syntaxLabelConfiguration: string = configuration.get("syntax.label", "default");
        this.labelRegExp = syntaxLabelConfiguration === "colonOptional"
            ? /(^[^\s:]+([\s:]|$))/
            : /(^\s*[^\s:]+:)/;

        const syntaxLineSeparatorConfiguration: string = configuration.get("syntax.lineSeparator", "none");
        const lineSeparator =
            syntaxLineSeparatorConfiguration === "colon" ? ":"
                : syntaxLineSeparatorConfiguration === "pipe" ? "|"
                    : undefined;

        const syntaxRepeatConfiguration: string = configuration.get("syntax.repeat", "none");
        this.repeatRegExp =
            syntaxRepeatConfiguration === "brackets" ? /^(?:\[([^\]]+)\]\s)(.+)$/
                : syntaxRepeatConfiguration === "dot" ? /^(?:\.(\S+)\s)(.+)$/
                    : undefined;

        this.timingsHintsConfiguration = configuration.get("timings.hints", "none");

        // Determines syntax
    }

    parse(rawSourceCode: string): MeterableCollection {

        const emptyMeterablesCollection = new MeterableCollection();

        // (sanity checks)
        if (!rawSourceCode) {
            return emptyMeterablesCollection;
        }
        const rawSourceCodeLines = rawSourceCode.split(/[\r\n]+/);
        if (rawSourceCodeLines.length === 0) {
            return emptyMeterablesCollection;
        }
        if (rawSourceCodeLines[rawSourceCodeLines.length - 1].trim() === "") {
            // (removes possible spurious empty line at the end of the selection)
            rawSourceCodeLines.pop();
            if (rawSourceCodeLines.length === 0) {
                return emptyMeterablesCollection;
            }
        }

        // Actual parsing
        const ret = new MeterableCollection();
        let meterables = ret;
        let repetitions = 1;

        const meterablesStack: MeterableCollection[] = [];
        const repetitionsStack: number[] = [];

        // Extracts the source code parts for every line
        rawSourceCodeLines.forEach(rawSourceCodeLine => {
            const sourceCodeParts =
                this.extractSourceCodePartsFrom(rawSourceCodeLine);

            // Parses the source code parts
            sourceCodeParts.forEach(sourceCodePart => {

                const rawPart = sourceCodePart.getPart();

                const newRepetitions =
                    this.syntaxConfiguration === "sjasmplus" ? SjasmplusDupParser.instance.parseDupOrRept(rawPart)
                        : this.syntaxConfiguration === "glass" ? GlassReptParser.instance.parseRept(rawPart)
                            : undefined;
                if (newRepetitions !== undefined) {
                    const previousMeterables = meterables;
                    meterablesStack.push(meterables);
                    meterables = new MeterableCollection();
                    previousMeterables.add(MeterableRepetition.of(meterables, newRepetitions));
                    repetitionsStack.push(repetitions);
                    repetitions *= newRepetitions;
                    return;
                }

                const endRepetitions =
                    this.syntaxConfiguration === "sjasmplus" ? SjasmplusDupParser.instance.parseEdupOrEndr(rawPart)
                        : this.syntaxConfiguration === "glass" ? GlassReptParser.instance.parseEndm(rawPart)
                            : false;
                if (endRepetitions) {
                    meterables = meterablesStack.pop() || ret;
                    repetitions = repetitionsStack.pop() || 1;
                    return;
                }

                meterables.add(this.parseSourceCodePart(sourceCodePart));
            });
        });

        return ret;
    }

    private extractSourceCodePartsFrom(rawSourceCodeLine: string): SourceCodePart[] {

        // Removes surrounding label and whitespace
        const cleanRawSourceCodeLine = rawSourceCodeLine.replace(this.labelRegExp, "").trim();

        // Splits the line and extracts trailing comment
        return normalizeAndSplitQuotesAware(cleanRawSourceCodeLine, this.lineSeparator).getParts();
    }

    private parseSourceCodePart(sourceCodePart: SourceCodePart): Meterable | undefined {

        const rawPart = sourceCodePart.getPart();

        // Tries to parse timing hints from the comment
        const isTimingsHintsSubroutines = this.timingsHintsConfiguration === "subroutines";
        const isTimingsHintsAny = this.timingsHintsConfiguration === "any";
        const timingHints = isTimingsHintsSubroutines || isTimingsHintsAny
            ? MeterableHint.of(sourceCodePart.getComment())
            : undefined;

        // Actually parses the source code part
        var meterable = this.parseRawInstruction(this.extractRawInstruction(rawPart));
        if (!meterable) {
            // No source code; returns timing hints (if any)
            return isTimingsHintsAny ? timingHints : undefined;
        }

        // Decorates source code with the optional timing hints (if any)
        if (timingHints) {
            meterable = TimingHintDecorator.of(meterable, timingHints, isTimingsHintsSubroutines);
        }

        // Parses and applies the optional repeat pseudo-op
        return MeterableRepetition.of(meterable, this.extractrepetitions(rawPart));
    }

    private extractRawInstruction(s: string): string {

        // Determines syntax
        if (!this.repeatRegExp) {
            return s;
        }

        // Tries to parse beyond the repeat pseudo-op
        const matches = this.repeatRegExp.exec(s);
        const hasRepeatInstruction = matches && matches.length >= 2 && matches[2];
        return hasRepeatInstruction ? matches[2] : s;
    }

    private extractrepetitions(s: string): number {

        // Determines syntax
        if (!this.repeatRegExp) {
            return 1;
        }

        // Tries to parse repeat pseudo-op
        const matches = this.repeatRegExp.exec(s);
        const hasrepetitions = matches && matches.length >= 1 && matches[1];
        if (!hasrepetitions) {
            return 1;
        }
        const repetitionsCandidate = NumericExpressionParser.parse(matches[1]);
        return repetitionsCandidate && repetitionsCandidate > 0 ? repetitionsCandidate : 1;
    }

    private parseRawInstruction(s: string): Meterable | undefined {

        // Tries to parse Z80 instructions
        const z80Instruction = Z80InstructionParser.instance.parseInstruction(s, this.instructionSets);
        if (z80Instruction) {
            return z80Instruction;
        }

        // Tries to parse sjasmplus alternative syntax and fake instructions
        if (this.syntaxConfiguration === "sjasmplus") {
            const sjasmplusFakeInstruction =
                SjasmplusFakeInstructionParser.instance.parse(s, this.instructionSets);
            if (sjasmplusFakeInstruction) {
                return sjasmplusFakeInstruction;
            }
            const sjasmplusRegisterListInstruction =
                SjasmplusRegisterListInstructionParser.instance.parse(s, this.instructionSets);
            if (sjasmplusRegisterListInstruction) {
                return sjasmplusRegisterListInstruction;
            }
        } else if (this.syntaxConfiguration === "glass") {
            const glassFakeInstruction =
                GlassFakeInstructionParser.instance.parse(s, this.instructionSets);
            if (glassFakeInstruction) {
                return glassFakeInstruction;
            }
        }

        // Tries to parse user-defined macro
        const macro = MacroParser.instance.parse(s, this.instructionSets);
        if (macro) {
            return macro;
        }

        // Tries to parse assembly directives
        const assemblyDirective = AssemblyDirectiveParser.instance.parse(s);
        if (assemblyDirective) {
            return assemblyDirective;
        }

        // (could not parse raw instruction)
        return undefined;
    }
}
