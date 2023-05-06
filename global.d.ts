declare global {
	interface LenientGlobalVariableTypes {
		canvas: never;
		game: never;
		socket: never;
		ui: never;
	}
	interface Window {
		ForgeVTT: any;
	}
	class ItemExtended extends Item {
		static schema: any;
		baseItem: string | null;
		documentLink: boolean;
		itemData: any;
		reset: any;
		get isLinked(): boolean;
	}
}

export {};
