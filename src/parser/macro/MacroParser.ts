import { workspace } from "vscode";
import { extractMnemonicOf } from "../../utils/AssemblyUtils";
import Macro from "./model/Macro";
import MacroDefinition from "./model/MacroDefinition";

export default class MacroParser {

    // Singleton
    static instance = new MacroParser();

    // Macro maps
    private macroDefinitionByMnemonic: Record<string, MacroDefinition>;

    private constructor() {
        this.macroDefinitionByMnemonic = this.loadMacroDefinitions();
    }

    reload() {
        this.macroDefinitionByMnemonic = this.loadMacroDefinitions();
    }

    private loadMacroDefinitions(): Record<string, MacroDefinition> {

        // Initializes macro maps
        const macroDefinitionByMnemonic: Record<string, MacroDefinition> = {};

        // Locates macro definitions
        const configuration = workspace.getConfiguration("z80-asm-meter");
        const macroDefinitions: MacroDefinition[] = configuration.get("macros", []);
        macroDefinitions.forEach(macroDefinition => {

            // Prepares a map by mnemonic for performance reasons
            const mnemonic = extractMnemonicOf(macroDefinition.name).toUpperCase();
            macroDefinitionByMnemonic[mnemonic] = macroDefinition;
        });

        return macroDefinitionByMnemonic;
    }

    parse(instruction: string, instructionSets: string[]): Macro | undefined {

        // Locates macro definition
        const mnemonic = extractMnemonicOf(instruction);
        const macroDefinition = this.macroDefinitionByMnemonic[mnemonic];
        if (!macroDefinition) {
            return undefined;
        }

        return new Macro(macroDefinition, instructionSets);
    }
}
