import { workspace } from "vscode";
import { Macro } from "./Macro";
import { extractMnemonicOf } from "./utils";

export class MacrosParser {

    // Singleton
    public static instance = new MacrosParser();

    public parse(instruction: string | undefined, instructionSets: string[]): Macro | undefined {

        if (!instruction) {
            return undefined;
        }

        const configuration = workspace.getConfiguration("z80-asm-meter");

        // Locates macro definition
        const mnemonic = extractMnemonicOf(instruction);
        const rawMacros : any[] = configuration.get("macros", []);
        for (let i = 0; i < rawMacros.length; i++) {
            const rawMacro = rawMacros[i];
            if (extractMnemonicOf(rawMacro.name).toUpperCase() === mnemonic) {
                return new Macro(rawMacro, instructionSets);
            }
        }
        return undefined;
    }
}
