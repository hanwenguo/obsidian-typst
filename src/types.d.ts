import { NodeAddFontBlobs } from "@myriaddreamin/typst-ts-node-compiler";

export interface Message {
    type: string,
    data: any
}

export interface WorkerStartUpOptions {
	workspace: string,
	fontArgs?: Array<NodeAddFontBlobs>
}
