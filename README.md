# Typst in Obsidian

This plugin is a fork of [fenjalien/obsidian-typst](https://github.com/fenjalien/obsidian-typst), using [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) instead of the WASM binding written by the original author, also cutting some features that are not necessary for me.

Renders `typst` code blocks, and optionally math blocks, into SVGs using [Typst](https://github.com/typst/typst).

## Using Packages
Packages are supported. However, they are not loadad from local typst cache due to browser (thus electron) security restrictions.

## Math Block Usage
The plugin can render `typst` inside math blocks! By default this is off, to enable it set the "Override Math Blocks" setting or use the "Toggle math block override" command. Math block types are conserved between Obsidian and Typst, `$...$` -> `$...$` and `$$...$$` -> `$ ... $`.

From what I've experimented with, normal math blocks are okay with Typst but Typst is not happy with any Latex code.

For styling and using imports with math blocks see the next section.

## Preambles

Need to style your `typst` code the same way everytime and don't to write it out each time? Or using math blocks and need a way to import things? Use PREAMBLES!

Preambles are prepended to your `typst` code before compiling. There are three different types on the "Typst Renderer" plugin settings page:
- `shared`: Prepended to all `typst` code.
- `math`: Prepended to `typst` code only in math blocks.
- `code`: Prepended to `typst` code only in code blocks.

The following variables are defined for you in all preambles to help style the output correctly:
- `WIDTH`: The horizontal size of the space the output will be placed in. Can be a `length` or `auto` if the space is not limited in that direction.
- `HEIGHT`: The vertical size of the space the output will be placed in. Can be a `length` or `auto` if the space is not limited in that direction.
- `SIZE`: The font size as defined by the CSS property `"--font-text-size"`
- `THEME`: A string defining the current theme of Obsidian. Either "light" or "dark".

The following are the default preambles.
<details>
<summary>Shared</summary>

```
#set text(fill: black, size: SIZE)
#set page(width: WIDTH, height: HEIGHT)
```
</details>
<details>
<summary>Math</summary>

```
#set page(margin: 0pt)
#set align(horizon)
```
</details>
<details>
<summary>Code</summary>

```
#set page(margin: (y: 1em, x: 0pt))
```
</details>

### Color Scheme
This plugin does not rerender when the color scheme changes. By default, the foreground color is set to black and uses a CSS filter to revert black color to white when the theme is dark. This interferes with other colors though.

## Installation
This plugin is not in plugin registry yet, so you have to install it manually.

Install it by copying `main.js`, `styles.css`, `obsidian_typst_bg.wasm` and `manifest.json` from the releases tab to the folder `.obsidian/plugins/typst` in your vault.

## TODO / Goals (In no particular order)
- [ ] Support loading fonts
- [ ] Adapt to color scheme changes
