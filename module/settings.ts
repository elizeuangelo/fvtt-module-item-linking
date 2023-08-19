export const TITLE = 'Item Linking';
export const MODULE = 'item-linking';

const settings = {
	linkHeader: {
		name: 'Link Header',
		hint: 'Linked items will also have their names and images linked.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	hideUselessInformation: {
		name: 'Hide Useless Information',
		hint: 'Will hide empty information on linked items.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	},
	enforceActorsFXs: {
		name: 'Enforce Active FXs on Actors',
		hint: 'Disables edit/deletion on active effects cloned from linked items and track updates on them.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false,
	},
	linkPropertyExceptions: {
		name: 'Link Property Exceptions',
		hint: 'Additional exception properties, in addition to the system configuration. Use a comma to separate the tags, example: "flags.beavers-crafting,system.description.value"',
		scope: 'world',
		config: true,
		type: String,
		default: '',
	},
	update: {
		scope: 'world',
		config: false,
		type: Number,
		default: 0,
	},
} as const;

export type Settings = typeof settings;

export function getSetting<T extends keyof Settings>(name: T) {
	return game.settings.get(MODULE, name) as unknown as ReturnType<Settings[T]['type']>;
}

export function setSetting<T extends keyof Settings>(name: T, value: ReturnType<Settings[T]['type']>) {
	return game.settings.set(MODULE, name, value);
}

Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE, key, setting as unknown as any);
	}
});
