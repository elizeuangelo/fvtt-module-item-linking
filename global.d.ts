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
	interface ModuleFlags {
		baseItem: string | null;
		isLinked: boolean;
	}
	class ItemExtended extends Item {
		_source: any;
		updateSource(changes: Object, options?: Object): Object;
		flags: {
			'item-linking'?: ModuleFlags;
		};
	}
}

export {};
