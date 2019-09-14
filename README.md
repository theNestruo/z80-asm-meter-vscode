# Z80 Assembly meter in Visual Studio Code

The **Z80 Assembly meter** extension for Visual Studio Code meters clock cycles and bytecode size from Z80 assembly source code.

## Features

Select Z80 assembly source code to view clock cycles and bytecode size in the status bar.

![Z80 Assembly meter](images/screenshot.png)

## Recommendations

This extension can be installed standalone, but does not contribute any problem matcher, symbol provider, definition provider, or completion proproser for Z80 assembly.

Therefore, this extension can be installed alongside other Z80-related extensions such as:

* [Z80 Macro-Assembler](https://marketplace.visualstudio.com/items?itemName=mborik.z80-macroasm) by mborik
* [pasmo](https://marketplace.visualstudio.com/items?itemName=boukichi.pasmo) by BouKiChi
* [Z80 Assembly](https://marketplace.visualstudio.com/items?itemName=Imanolea.z80-asm) by Imanolea
* (and probably others)

## Extension Settings

This extension contributes the following settings:

* `z80-asm-meter.maxLines`: When working with huge files, metering can be disabled when the line count of the selection exceeds a certain threshold. Unlimited by default.

* `z80-asm-meter.maxLoC`: Stops metering when the parsed lines of code (LoC) count exceeds a certain threshold. Unlimited by default.
* `z80-asm-meter.timing`: Controls the visibility of the timing information in the status bar:
    * `disabled`: Timing information is not shown.
    * `z80`: Only Z80 timing information is shown.
    * `msx`: Only Z80 + M1 timing information is shown. Useful for Z80 timing calculations on MSX, as the MSX standard requires so-called M1 wait cycles.
    * `both` (default): Both Z80 and Z80+M1 timing information are shown.
* `z80-asm-meter.size`: Controls the visibility of the size information in the status bar:
    * `disabled`: Size information is not shown.
    * `bytecode` (default): Only bytecode size information is shown.
    * `loc`: Only processed lines of code (LOC) count is shown.
    * `both`: Both bytecode size and LOC count are shown.

## Credits

Coded by [**theNestruo**](https://github.com/theNestruo) ([Néstor Sancho](https://twitter.com/NestorSancho)).
* Inspired by Rafael Jannone [BiT](http://msx.jannone.org/bit/).
* Z80 Instruction Set from Grauw [MSX Assembly Page](http://map.grauw.nl/resources/z80instr.php).

## Release Notes

### 0.1.0 2019-09-14

- Initial release
