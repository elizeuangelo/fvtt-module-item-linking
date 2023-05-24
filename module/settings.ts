export const TITLE = 'Item Linking';
export const MODULE = 'item-linking';

const settings = {
	//snapTokens: {
	//	name: 'Snap Tokens',
	//	scope: 'world',
	//	config: false,
	//	type: Boolean,
	//	default: true,
	//	onChange: (value) => canvas.tokens!.placeables.forEach((t) => t.refresh()),
	//},
	//scatter: {
	//	name: 'Scattering',
	//	hint: 'How much the tokens will scatter around?',
	//	scope: 'world',
	//	config: true,
	//	type: Number,
	//	default: 0.4,
	//	range: {
	//		min: 0.01,
	//		max: 1,
	//		step: 0.01,
	//	},
	//},
	//ignoreDead: {
	//	name: 'Ignore Special Cases',
	//	hint: 'Dead or incapacitated tokens will not be snapped.',
	//	scope: 'world',
	//	config: true,
	//	type: Boolean,
	//	default: true,
	//},
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
