
## 0.6.0

- Support for line with multiple instructions, by contributor: **IIIvan37**
- Correction nop timing for INC HL, by contributor: **IIIvan37**

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
