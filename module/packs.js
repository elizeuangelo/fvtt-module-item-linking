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
 * Checks if an item is from a Compendium source.
 *
 * @param {Item} item - The item to check.
 * @returns {boolean} - Returns true if the item is from a Compendium source, false otherwise.
 */
export function fromCompendiumSource(item) {
	return item._stats.compendiumSource || Boolean(/Compendium/.exec(item.flags.core?.sourceId));
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

