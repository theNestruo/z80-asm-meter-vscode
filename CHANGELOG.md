## 5.3.5

- Fix Amstrad CPC timing of some instructions, by contributor: **RenaudLottiaux**

## 5.3.4

- Fixes user-defined macros not working correctly. #156

## 5.3.3

- Ability to show size in bytes in both decimal and hexadecimal in the status bar.

## 5.3.2

- Status bar examples in the documentation.
- Expand selection to line enabled by default.
- Revised documentation; especially advanced features.

## 5.3.1

- Fixes settings UI issues (caused by shadowed configuration setting ids). #150

## 5.3.0

- Support for `RB`/`RW` directives. #149
- Fixes wrong behaviour when `z80-asm-meter.syntax.label.colonOptional` is enabled. #150

## 5.2.0

- Ability to expand selection to line
- More flexible status bar customization
- Fixes settings default values being ignored. #145
- Further division of total timing at exit based on the last instruction. #146
- Restores missing MSX and NEC PC-8000 series timing information in the tooltip. #147

## 5.1.0

- Fixes extension activation issue
- Additional customizations, such as the status bar icons

## 5.0.0

- Code refactor
- Extension settings reorganized for clarity, easiness of setup, and additional customizations
- Performance improvements
- Improved instruction support within macro definitions. #134
- New `z80-asm-meter.timing.executionFlow.stopOnUnconditionalJump` and `z80-asm-meter.timing.atExit.stopOnUnconditionalJump` settings. #143
- Timing hints can now ignore empty lines with commented out source code. #144
- RegExp-based user-defined timing hints. #134

## 4.3.0

- Improvements in the advanced timing modes. #114

## 4.2.0

- Glass Z80 assembler syntax support. #123
- Fixes `directivesAsInstructions` configuration property. #125
- Reloadable user-defined macros

## 4.1.0

- Responsiveness improvement

## 4.0.0

- Extension is now bundled with esbuild (performance improvement)

## 3.7.0

- Fixes missing documentation of configuration property `directivesAsInstructions`
- Prevents metering from being called too frequently when the selection changes

## 3.6.1

- Fixes wrong repeat counts with nested SjASMPlus `DUP`s/`REPT`s
- Fixes edge cases when timing "at exit" is enabled

## 3.6.0

- Support for SjASMPlus `DUP`/`EDUP` and `REPT`/`ENDR` repetitions. #99
- Advanced timing algorithms: timing "at exit", subroutine timing hints. #114
- Performance improvements

## 3.5.4

- Fixes missing instruction when `EX AF,AF'` is followed by a comment. #112

## 3.5.3

- Fixes incorrect byte counting with single quotes. #107

## 3.5.2

- Fixes incorrect byte counting with ";". #105

## 3.5.1

- Fixes wrong instructions detection when `"z80-asm-meter.syntax.label": "colonOptional"`. #100

## 3.5.0

- Performance improvement (better `activationEvents`). #3

## 3.4.2

- Code clean-up
- Fixes quoted values detection (mainly in `DB`/`DEFB` directives)

## 3.4.1

- Fixes Sjasm and SjASMPlus repeat count. #99

## 3.4.0

- Support for `DM`/`DEFM` directives (as synonyms for `DB`/`DEFB`)
- Fixes wrong "generic" instructions detection (such as `INC IYq`)
- Support for SjASMPlus register lists instructions. #99
- Performance improvement

## 3.3.0

- Improved opcodes for "generic" instructions (such as `BIT b,r`)

## 3.2.0

- Improved detection for `RST 8H`, `RST 10H`, `RST 18H`, `RST 20H`, `RST 28H`, `RST 30H` and `RST 38H`

## 3.1.0

- Support for NEC PC-8000 series
- Support for Sjasm and SjASMPlus repeat count

## 3.0.1

- Fixes wrong `DW`/`DEFW` directive size

## 3.0.0

- Code refactor
- Support for user-defined macros. #73
- Configuration properties ~~`maxBytes`~~, ~~`maxLines`~~, and ~~`maxLoC`~~ removed

## 2.1.0

- Improved support for SjASMPlus alternate syntax (such as `EXA`)
- Configuration property ~~`sjasmplusFakeInstructions`~~ renamed to `sjasmplus`

## 2.0.0

- Code refactor
- Support for parsing SjASMPlus fake instructions. #65
- Added `SLI` as alternative syntax for `SL1`/`SLL`

## 1.6.1

- Code clean-up

## 1.6.0

- Support for `DB`/`DEFB`/`DW`/`DEFW` directives
- Improved support for `DS`/`DEFS` directives: single byte instruction detection can be disabled
- Support for negative values
- Support for multiple instructions on one line with line separators (such as colon `:` or pipe `|`)
- Improved tooltip format
- Configuration properties ~~`maxOpcodes`~~ and ~~`viewOpcode`~~ renamed to `maxBytes` and `viewBytes`

## 1.5.0

- Single byte instructions with an 8 bit register operand (such as `AND r`) are now recognized as separate instructions (`AND A`, `AND B`, ...)
- Fixed issues:
    - Use of `DS`/`DEFS` directives for `NOP`s. #40

## 1.4.0

- Fixed issues:
    - Need support for SDCC syntax on index-registers and explicit accumulator. #33

## 1.3.1

- Fixes representation of some opcodes (such as `NOP`, that was showing `0` instead of `00`)

## 1.3.0

- Single status bar item and simplified configuration settings

## 1.2.0

- Abiliy to copy the clock cycles and the bytecode size information to the clipboard

## 1.1.0

- _DeZog - Z80 Debugger_ compatibility added to the default configuration. #11, #20
- Support for Pasmo and SjASMPlus assembler syntax (labels without trailing colon), thanks to contributor: **alexanderk23**

## 1.0.2

- Correct CPC timing for several instructions, thanks to **IIIvan37**

## 1.0.1

- Correct size for `DEC L`, `LD HL,(NN)`, and `IN F,(C)`, thanks to [**Grauw**](http://map.grauw.nl)
- Fixes configuration settings types

## 1.0.0

- Simplified configuration settings
- Support for Z80N (ZX Spectrum Next Extended Z80 instruction set), by contributor: **Kris Borowinski**
- Fixed issues:
    - Halves of index registers not always recognized. #17

## 0.6.1

- Correct IX/IY optional offset support, by contributor: **IIIvan37**
- Removed some `console.log`

## 0.6.0

- Support for line with multiple instructions, by contributor: **IIIvan37**
- Correction nop timing for `INC HL`, by contributor: **IIIvan37**

## 0.5.3

- Fixed issues:
    - Wrong opcodes for push/pop af #8

## 0.5.2

- Correction timing opcode `LD BC, (nn)`, by contributor: **IIIvan37**

## 0.5.1

- Fixes instruction status bar item not being hidden

## 0.5.0

- New option to display opcodes, by contributor: **hlide**
- Visibility configuration for instruction and its opcode
- Fixed issues:
    - Some invalid instructions are falsely counted as valid. #6

## 0.4.0

- Added `"z80"` (MSX Z80 by Yeoungman Seo) to the default additional language IDs
- Metering of the current line if there is no selection, by contributor: **hlide**

## 0.3.0

- Added configurable additional language IDs for which the extension is enabled

## 0.2.1

- Amstrad CPC timing explained in the readme file
- Added missing undocumented instructions: `OUT (C),0`, `SL1`/`SLL`
- Added alternative syntax: `JP HL`, `IN (C)`

## 0.2.0

- Amstrad CPC timing in NOPs added by contributor: **IIIvan37**
- Code refactor (for future improvements)

## 0.1.1

- Code clean-up
- CodeFactor integration
- Travis-CI integration

## 0.1.0

- Initial release
