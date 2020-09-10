
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
