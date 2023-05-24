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
		embedded: Record<string, Record<string, string>>;
	}
	class ItemExtended extends Item {
		_source: any;
		system: any;
		validate: any;
		collections: Record<string, any>;
		baseItem?: ItemExtended;
		updateSource(changes: Object, options?: Object): Object;
		flags: {
			'item-linking'?: ModuleFlags;
		};
	}
}

export {};
