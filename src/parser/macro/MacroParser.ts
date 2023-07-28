import { workspace } from "vscode";
import { extractMnemonicOf } from "../../utils/utils";
import Macro from "./model/Macro";
import MacroDefinition from "./model/MacroDefinition";

export default class MacroParser {

    // Singleton
    static instance = new MacroParser();

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

    parse(instruction: string | undefined, instructionSets: string[]): Macro | undefined {

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
