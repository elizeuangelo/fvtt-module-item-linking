import { findCompendiumFromItemID } from './packs.js';
import { MODULE_ID } from './settings.js';

/**
 * Retrieves the value of a flag from an item.
 * @param {Item} item - The item to retrieve the flag from.
 * @param {string} name - The name of the flag.
 * @returns {*} The value of the flag.
 */
export function getFlag(item, name) {
	return item.getFlag(MODULE_ID, name);
}

/**
 * Sets a flag on an item.
 * @param {Item} item - The item to set the flag on.
 * @param {string} name - The name of the flag.
 * @param {*} value - The value of the flag.
 * @returns {Promise<Item>} - A promise that resolves to the item with the flag set.
 */
export function setFlag(item, name, value) {
	return item.setFlag(MODULE_ID, name, value);
}

/**
 * Pre-create Item Hook for setting the initial flags for item linking.
 * @param {Object} item - The item object to be pre-created.
 */
function preCreateItem(item) {
	const baseFlags = {
		baseItem: null,
		isLinked: false,
	};
	const isCompendium = Boolean(item.compendium);
	const itemFlags = isCompendium ? baseFlags : item._source.flags['item-linking'] || baseFlags;
	if (isCompendium === false && item.id) {
		if (!itemFlags.isLinked && !itemFlags.baseItem) {
			const compendium = findCompendiumFromItemID(item.id);
			if (compendium) {
				itemFlags.baseItem = 'Compendium.' + compendium.metadata.id + '.Item.' + item.id;
				itemFlags.isLinked = true;
			}
		}
	}
	item.updateSource({ 'flags.item-linking': itemFlags });
}

/** -------------------------------------------- */
Hooks.on('preCreateItem', preCreateItem);

