import { workspace } from "vscode";
import { Macro } from "./Macro";
import { MacroDefinition } from "./MacroDefinition";
import { extractMnemonicOf } from "./utils";

export class MacroParser {

    // Singleton
    public static instance = new MacroParser();

    // Macro maps
    private macroDefinitionByMnemonic: Record<string, MacroDefinition>;
    // private macroByMnemonic: Record<string, Macro>;

    private constructor() {

        // Initializes macro maps
        this.macroDefinitionByMnemonic = {};

        // Locates macro definitions
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const macroDefinitions: MacroDefinition[] = configuration.get("macros", []);
        macroDefinitions.forEach(macroDefinition => {

            // Prepares a map by mnemonic for performance reasons
            const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
            this.macroDefinitionByMnemonic[mnemonic] = macroDefinition;
        });
    }

    public parse(instruction: string | undefined, instructionSets: string[]): Macro | undefined {

        if (!instruction) {
            return undefined;
        }

        // Locates macro definition
        const mnemonic = extractMnemonicOf(instruction);
        const macroDefinition = this.macroDefinitionByMnemonic[mnemonic];
        if (!macroDefinition) {
            return undefined;
        }

        const macro = new Macro(macroDefinition, instructionSets);
        return macro;
    }
}
