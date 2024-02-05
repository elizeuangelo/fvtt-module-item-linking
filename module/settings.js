export const TITLE = 'Item Linking';
export const MODULE_ID = 'item-linking';

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
	debug: {
		name: 'Enable logging debug',
		hint: 'Print on the web console more informations about this module.',
		scope: 'client',
		config: true,
		type: Boolean,
		default: false,
	},
};

/**
 * Retrieves the value of a specific setting.
 *
 * @param {string} name - The name of the setting.
 * @returns {*} The value of the setting.
 */
export function getSetting(name) {
	return game.settings.get(MODULE_ID, name);
}

/**
 * Sets a module setting value.
 *
 * @param {string} name - The name of the setting.
 * @param {*} value - The value to set for the setting.
 * @returns {Promise} A Promise that resolves when the setting is successfully set.
 */
export function setSetting(name, value) {
	return game.settings.set(MODULE_ID, name, value);
}

/** -------------------------------------------- */
Hooks.once('setup', () => {
	for (const [key, setting] of Object.entries(settings)) {
		game.settings.register(MODULE_ID, key, setting);
	}
});
