export let PACKS = [];

/**
 * Retrieves packs of a specific type.
 * @returns {Array} An array of packs.
 */
function getPacksByType() {
	const type = 'Item';
	const packs = [];
	for (const pack of game.packs.values()) {
		if (pack.metadata.type === type) packs.push(pack);
	}
	return (PACKS = packs);
}

/**
 * Finds the compendium that contains an item with the given ID.
 * @param {string} id - The ID of the item.
 * @returns {object|null} - The compendium object if found, or null if not found.
 */
export function findCompendiumFromItemID(id) {
	for (const pack of PACKS) {
		const res = pack.index.get(id);
		if (res !== undefined) return pack;
	}
	return null;
}

/**
 * Retrieves items indexes from a compendium based on their type.
 * @param {Compendium} compendium - The compendium to retrieve items from.
 * @param {string} type - The type of items to retrieve.
 * @returns {Array} - An array of items indexes matching the specified type.
 */
export function getItemsFromCompendiumsByType(compendium, type) {
	return compendium.index.filter((i) => i.type === type);
}

/**
 * Creates a UUID from the given pack and item ID.
 * @param {object} pack - The pack object.
 * @param {string} itemId - The item ID.
 * @returns {string} The generated UUID.
 */
export function createUuidFromIndex(pack, itemId) {
	return `Compendium.${pack.metadata.id}.Item.${itemId}`;
}

/** -------------------------------------------- */
Hooks.on('renderCompendiumDirectory', getPacksByType);

