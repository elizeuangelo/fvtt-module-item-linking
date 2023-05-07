import { getFlag } from './flags.js';

/**
 * Returns the item from an Unique Identifier
 * @param uuid
 * @returns
 */
export function findItemFromUUID(uuid: string) {
	return fromUuid(uuid) as Promise<ItemExtended | null>;
}

export function findCompendiumFromItemID(id: string) {
	for (const pack of PACKS) {
		const res = pack.index.get(id);
		if (res !== undefined) return pack;
	}
	return null;
}

/**
 * Creates an Unique Identifier for the Base Item
 * @param item
 * @returns
 */
export async function stringifyItem(item: ItemExtended) {
	let baseItem: ItemExtended | null = null;
	while (getFlag(item, 'baseItem') !== null) {
		baseItem = await findItemFromUUID(getFlag(item, 'baseItem') as string);
		if (baseItem === null) break;
		item = baseItem;
	}
	return item.uuid;
}

export let PACKS: CompendiumCollection<CompendiumCollection.Metadata>[] = [];
function getPacksByType() {
	const type = 'Item';
	const packs: CompendiumCollection<CompendiumCollection.Metadata>[] = [];
	for (const pack of game.packs.values()) {
		if (pack.metadata.type === type) packs.push(pack);
	}
	return (PACKS = packs);
}

/** -------------------------------------------- */
Hooks.on('renderCompendiumDirectory', getPacksByType);
