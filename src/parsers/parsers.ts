import { OptionalSingletonRef } from "../types/References";
import { assemblyDirectiveParser } from "./instructions/impl/AssemblyDirectiveParser";
import { glassFakeInstructionParser } from "./instructions/impl/GlassFakeInstructionParser";
import { glassReptRepetitionParser } from "./instructions/impl/GlassReptRepetitionParser";
import { macroParser } from "./instructions/impl/MacroParser";
import { sjasmplusDupRepetitionParser } from "./instructions/impl/SjasmplusDupRepetitionParser";
import { sjasmplusFakeInstructionParser } from "./instructions/impl/SjasmplusFakeInstructionParser";
import { sjasmplusRegisterListInstructionParser } from './instructions/impl/SjasmplusRegisterListInstructionParser';
import { sjasmplusReptRepetitionParser } from './instructions/impl/SjasmplusReptRepetitionParser';
import { z80InstructionParser } from "./instructions/impl/Z80InstructionParser";
import { InstructionParser } from "./instructions/types/InstructionParser";
import { RepetitionParser } from "./instructions/types/RepetitionParser";
import { MainParserRef } from "./main/impl/MainParserImpl";
import { defaultTimingHintsParser } from "./timingHints/impl/DefaultTimingHintsParser";
import { regExpTimingHintsParser } from "./timingHints/impl/RegExpTimingHintsParser";
import { TimingHintsParser } from "./timingHints/types/TimingHintsParser";

/** All the available instrucion parsers, properly ordered */
export const availableInstructionParsers: OptionalSingletonRef<InstructionParser>[] = [
	sjasmplusFakeInstructionParser,
	sjasmplusRegisterListInstructionParser,
	glassFakeInstructionParser,
	z80InstructionParser, // (after SjASMPlus and Glass Z80 assembler parsers)
	macroParser,
	assemblyDirectiveParser
];

/** All the available repetition parsers, properly ordered */
export const availableRepetitionParsers: OptionalSingletonRef<RepetitionParser>[] = [
	sjasmplusDupRepetitionParser,
	sjasmplusReptRepetitionParser,
	glassReptRepetitionParser
];

/** All the available timing hint parsers, properly ordered */
export const availableTimingHintsParsers: OptionalSingletonRef<TimingHintsParser>[] = [
    defaultTimingHintsParser,
    regExpTimingHintsParser
];

/** Main parser default instance */
export const mainParser = new MainParserRef(
	availableInstructionParsers,
	availableRepetitionParsers,
	availableTimingHintsParsers);

/** Main parser instance for macro parsers */
export const mainParserForMacroParser = new MainParserRef(
	availableInstructionParsers.filter(parser => parser !== macroParser), // (prevent circular nesting)
	availableRepetitionParsers,
	availableTimingHintsParsers);

/** Main parser instance for timing hint parsers */
export const mainParserForTimingHintsParsers = new MainParserRef(
	availableInstructionParsers,
	availableRepetitionParsers,
	[]); // (do not use timing hint parsers)
