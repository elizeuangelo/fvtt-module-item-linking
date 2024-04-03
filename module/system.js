import { canOverride } from './item-overrides.js';
import { MODULE_ID } from './settings.js';

const KEEP_PROPERTIES = [];

export function keepPropertiesOverride(itemData) {
	if (!canOverride(itemData)) return KEEP_PROPERTIES;
	const exceptions = itemData.flags?.[MODULE_ID]?.linkPropertyExceptions ?? '';
	return [...KEEP_PROPERTIES, ...(exceptions !== '' ? exceptions.split(',') : [])];
}

/**
 * Import the current system, if supported, and get the its keep properties
 * Currently only supports dnd5e
 */
Hooks.once('ready', async () => {
	let system = '';
	switch (game.system.id) {
		case 'dnd5e':
			system = './systems/dnd5e.js';
	}
	if (system === '') return;
	const { KEEP } = await import(system);
	KEEP_PROPERTIES.push(...KEEP);
});

