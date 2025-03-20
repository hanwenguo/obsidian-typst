import { Message, WorkerStartUpOptions } from "src/types";
import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
import { FetchAccessModel } from "@myriaddreamin/typst.ts/dist/esm/fs/fetch.mjs";
// @ts-ignore
import compilerWasm from "../node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm";
// @ts-ignore
import rendererWasm from "../node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm";

const fetchBackend = new FetchAccessModel(
	'http://localhost:20810',
);

// let compilerArgs: CompileArgs

/**
* Lazily created compiler.
*/
// let _compiler: NodeCompiler
/**
* Lazily created compiler.
*/
// const getCompiler = () => (_compiler ||= NodeCompiler.create(compilerArgs))

onmessage = async (ev: MessageEvent<Message>) => {
    const message = ev.data
    switch (message.type) {
        case "startup":
			const { workspace } = message.data as WorkerStartUpOptions
			// compilerArgs = (message.data as WorkerStartUpOptions)
			// _compiler = NodeCompiler.create(compilerArgs)
			$typst.setCompilerInitOptions({
				getModule: async () => {
					return compilerWasm.buffer;
				},
			});
			$typst.setRendererInitOptions({
				getModule: async () => {
					return rendererWasm.buffer;
				  },
			});
			$typst.use(
				TypstSnippet.withAccessModel(fetchBackend),
          		TypstSnippet.fetchPackageRegistry(fetchBackend),
			)
			console.log("Typst compiler worker started up!")
            break;
        case "compile":
			// const compileDocArgs: CompileDocArgs = message.data
            // postMessage(getCompiler().svg(compileDocArgs))
			const svgResult = await $typst.svg(message.data)
			postMessage(svgResult)
            break;
        default:
            throw message
    }
}

console.log("Typst compiler worker loaded!");
