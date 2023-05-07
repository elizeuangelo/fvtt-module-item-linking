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

export let PACKS: CompendiumCollection<CompendiumCollection.Metadata>[] = [];
function getPacksByType() {
	const type = 'Item';
	const packs: CompendiumCollection<CompendiumCollection.Metadata>[] = [];
	for (const pack of game.packs.values()) {
		if (pack.metadata.type === type) packs.push(pack);
	}
	return (PACKS = packs);
}

export function getItemsFromCompendiumsByType(compendium, type: string) {
	return compendium.index.filter((i: any) => i.type === type);
}

export function createUuidFromIndex(pack: CompendiumCollection<CompendiumCollection.Metadata>, itemId: string) {
	return `Compendium.${pack.metadata.id}.${itemId}`;
}

/** -------------------------------------------- */
Hooks.on('renderCompendiumDirectory', getPacksByType);
