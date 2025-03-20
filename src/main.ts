import { App, renderMath, Platform, Plugin, PluginSettingTab, Setting, loadMathJax, normalizePath, Notice, requestUrl } from 'obsidian';

declare const PLUGIN_VERSION: string;

// @ts-ignore
import CompilerWorker from "./compiler.worker.ts"

import TypstRenderElement from './typst-render-element.js';
import { WorkerStartUpOptions } from './types';
import * as path from 'path';

interface TypstPluginSettings {
	default_em: number,
    search_system: boolean,
    override_math: boolean,
    font_families: string[],
    preamable: {
        shared: string,
        math: string,
        code: string,
    },
    plugin_version: string,
    autoDownloadPackages: boolean
}

const DEFAULT_SETTINGS: TypstPluginSettings = {
	default_em: 11,
    search_system: false,
    override_math: false,
    font_families: [],
    preamable: {
        shared: "#set text(fill: black, size: SIZE)\n#set page(width: WIDTH, height: HEIGHT)",
        math: "#set page(margin: 0pt)\n#set align(horizon)",
        code: "#set page(margin: (y: 1em, x: 0pt))"
    },
    plugin_version: PLUGIN_VERSION,
    autoDownloadPackages: true
}

export default class TypstPlugin extends Plugin {
    settings: TypstPluginSettings;

    compilerWorker: Worker;

    tex2chtml: any;

    prevCanvasHeight: number = 0;
    fs: any;

    pluginPath: string

    async onload() {
        console.log("loading Typst Renderer");

        await this.loadSettings()

        this.pluginPath = this.app.vault.configDir + "/plugins/obsidian-typst"
		// @ts-expect-error
		const vaultAbsolutePath = this.app.vault.adapter.basePath.replace(/\\/g, "/")

		let workerStartupOptions: WorkerStartUpOptions = {
			workspace: vaultAbsolutePath + '/' + this.pluginPath,
		}

		// if (Platform.isDesktopApp) {
		// 	this.fs = require("fs")
		// 	let fonts: Array<Buffer> = await Promise.all(
		// 		//@ts-expect-error
		// 		(await window.queryLocalFonts() as Array)
		// 			.filter((font: { family: string; fullName: string; }) => this.settings.font_families.includes(font.family.toLowerCase()))
		// 			.map(
		// 				async (font: { blob: () => Promise<Blob>; }) => Buffer.from(await (await font.blob()).arrayBuffer())
		// 			)
		// 	)

		// 	workerStartupOptions.fontArgs = fonts.map((font) => ({ fontBlobs: [font] }))
		// }

        this.compilerWorker = (new CompilerWorker() as Worker);
        this.compilerWorker.postMessage({
            type: "startup",
            data: workerStartupOptions
        });

        // Setup custom canvas
        TypstRenderElement.compile = (a, b, c, d) => this.processThenCompileTypst(a, b, c, d)
        if (customElements.get("typst-renderer") == undefined) {
            customElements.define("typst-renderer", TypstRenderElement)
        }

        // Setup MathJax
        await loadMathJax()
        renderMath("", false);
        // @ts-expect-error
        this.tex2chtml = MathJax.tex2chtml
        this.overrideMathJax(this.settings.override_math)

        this.addCommand({
            id: "toggle-math-override",
            name: "Toggle math block override",
            callback: () => this.overrideMathJax(!this.settings.override_math)
        })

        // Settings
        this.addSettingTab(new TypstSettingTab(this.app, this));

        // Code blocks
        this.registerMarkdownCodeBlockProcessor("typst", async (source, el, ctx) => {
            el.appendChild(this.createTypstRenderElement(`${this.settings.preamable.code}\n${source}`, true, false))
        })

        console.log("loaded Typst Renderer");
    }

    async compileToTypst(source: string /*, size: number, display: boolean */): Promise<ImageData> {
        return await navigator.locks.request("typst renderer compiler", async (lock) => {
            const message = {
                    type: "compile",
                    data: {
						mainContent: source,
                    }
                }
            this.compilerWorker.postMessage(message)
            while (true) {
                let result: string;
                try {
                    result = await new Promise((resolve, reject) => {
                        const listener = (ev: MessageEvent<string>) => {
                            remove();
                            resolve(ev.data);
                        }
                        const errorListener = (error: ErrorEvent) => {
                            remove();
                            reject(error.message)
                        }
                        const remove = () => {
                            this.compilerWorker.removeEventListener("message", listener);
                            this.compilerWorker.removeEventListener("error", errorListener);
                        }
                        this.compilerWorker.addEventListener("message", listener);
                        this.compilerWorker.addEventListener("error", errorListener);
                    })
                } catch (e) {
                    throw e
                }
                if (typeof result == "string") {
                    return result
                }
            }
        })
    }

    async processThenCompileTypst(source: string, size: number, display: boolean, fontSize: number) {
        const dpr = window.devicePixelRatio;
        // * (72 / 96)
        const pxToPt = (px: number) => px.toString() + "pt"
        const sizing = `#let (WIDTH, HEIGHT, SIZE, THEME) = (${display ? pxToPt(size) : "auto"}, ${!display ? pxToPt(size) : "auto"}, ${pxToPt(fontSize)}, "${document.body.getCssPropertyValue("color-scheme")}")`
        return this.compileToTypst(
            `${sizing}\n${this.settings.preamable.shared}\n${source}`,
            // size,
            // display
        )
    }

    createTypstRenderElement(source: string, display: boolean, math: boolean) {
        let renderer = new TypstRenderElement();
        renderer.source = source
        renderer.display = display
        return renderer
    }

    createTypstMath(source: string, r: { display: boolean }) {
        const display = r.display;
        source = `${this.settings.preamable.math}\n${display ? `$ ${source} $` : `$${source}$`}`

        return this.createTypstRenderElement(source, display, true)
    }

    onunload() {
        // @ts-expect-error
        MathJax.tex2chtml = this.tex2chtml
        this.compilerWorker.terminate()
    }

    async overrideMathJax(value: boolean) {
        this.settings.override_math = value
        await this.saveSettings();
        if (this.settings.override_math) {
            // @ts-expect-error
            MathJax.tex2chtml = (e, r) => this.createTypstMath(e, r)
        } else {
            // @ts-expect-error
            MathJax.tex2chtml = this.tex2chtml
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

}

class TypstSettingTab extends PluginSettingTab {
    plugin: TypstPlugin;

    constructor(app: App, plugin: TypstPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }


    async display() {
        const { containerEl } = this;

        containerEl.empty();

		new Setting(containerEl)
			.setName("Default Font Size")
			.setDesc("The default font size for Typst documents.")
			.addText(text => text
				.setPlaceholder("11")
				.setValue(this.plugin.settings.default_em.toString())
				.onChange(async (value) => {
					this.plugin.settings.default_em = parseInt(value);
					await this.plugin.saveSettings();
				}));

        new Setting(containerEl)
            .setName("Override Math Blocks")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.override_math)
                    .onChange((value) => this.plugin.overrideMathJax(value))
            });

        new Setting(containerEl)
            .setName("Shared Preamble")
            .addTextArea((c) => c.setValue(this.plugin.settings.preamable.shared).onChange(async (value) => { this.plugin.settings.preamable.shared = value; await this.plugin.saveSettings() }))
        new Setting(containerEl)
            .setName("Code Block Preamble")
            .addTextArea((c) => c.setValue(this.plugin.settings.preamable.code).onChange(async (value) => { this.plugin.settings.preamable.code = value; await this.plugin.saveSettings() }))
        new Setting(containerEl)
            .setName("Math Block Preamble")
            .addTextArea((c) => c.setValue(this.plugin.settings.preamable.math).onChange(async (value) => { this.plugin.settings.preamable.math = value; await this.plugin.saveSettings() }))

        //Font family settings
        if (!Platform.isMobileApp) {

            const fontSettings = containerEl.createDiv({ cls: "setting-item font-settings" })
            fontSettings.createDiv({ text: "Fonts", cls: "setting-item-name" })
            fontSettings.createDiv({ text: "Font family names that should be loaded for Typst from your system. Requires a reload on change.", cls: "setting-item-description" })

            const addFontsDiv = fontSettings.createDiv({ cls: "add-fonts-div" })
            const fontsInput = addFontsDiv.createEl('input', { type: "text", placeholder: "Enter a font family", cls: "font-input", })
            const addFontBtn = addFontsDiv.createEl('button', { text: "Add" })

            const fontTagsDiv = fontSettings.createDiv({ cls: "font-tags-div" })

            const addFontTag = async () => {
                if (!this.plugin.settings.font_families.contains(fontsInput.value)) {
                    this.plugin.settings.font_families.push(fontsInput.value.toLowerCase())
                    await this.plugin.saveSettings()
                }
                fontsInput.value = ''
                this.renderFontTags(fontTagsDiv)
            }

            fontsInput.addEventListener('keydown', async (ev) => {
                if (ev.key == "Enter") {
                    addFontTag()
                }
            })
            addFontBtn.addEventListener('click', async () => addFontTag())

            this.renderFontTags(fontTagsDiv)
        }
    }

    renderFontTags(fontTagsDiv: HTMLDivElement) {
        fontTagsDiv.innerHTML = ''
        this.plugin.settings.font_families.forEach((fontFamily) => {
            const fontTag = fontTagsDiv.createEl('span', { cls: "font-tag" })
            fontTag.createEl('span', { text: fontFamily, cls: "font-tag-text", attr: { style: `font-family: ${fontFamily};` } })
            const removeBtn = fontTag.createEl('span', { text: "x", cls: "tag-btn" })
            removeBtn.addEventListener('click', async () => {
                this.plugin.settings.font_families.remove(fontFamily)
                await this.plugin.saveSettings()
                this.renderFontTags(fontTagsDiv)
            })
        })
    }

}
