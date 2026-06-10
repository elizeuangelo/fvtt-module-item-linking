import { canOverride } from './item-overrides.js';
import { MODULE_ID, getSetting } from './settings.js';

const KEEP_PROPERTIES = [];
let systemImportPromise = null;

export function keepPropertiesOverride(itemData) {
	const globalExceptions = getSetting('linkPropertyExceptions');
	if (!canOverride(itemData)) {
		return [...KEEP_PROPERTIES, ...(globalExceptions !== '' ? globalExceptions.split(',') : [])];
	}
	const itemExceptions = itemData.flags?.[MODULE_ID]?.linkPropertyExceptions ?? '';
	return [
		...KEEP_PROPERTIES,
		...(itemExceptions !== '' ? itemExceptions.split(',') : []),
		...(globalExceptions !== '' ? globalExceptions.split(',') : []),
	];
}

export async function initializeSystemSupport() {
	if (systemImportPromise) return systemImportPromise;
	let system = '';
	switch (game.system.id) {
		case 'dnd5e':
			system = './systems/dnd5e.js';
	}
	if (system === '') return null;
	systemImportPromise = import(system).then(({ KEEP }) => {
		for (const property of KEEP) {
			if (!KEEP_PROPERTIES.includes(property)) KEEP_PROPERTIES.push(property);
		}
	});
	return systemImportPromise;
}

/**
 * Import the current system, if supported, and get its keep properties.
 * Currently only supports dnd5e.
 */
Hooks.once('setup', initializeSystemSupport);
