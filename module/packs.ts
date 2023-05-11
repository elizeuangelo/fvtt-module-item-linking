export const baseItems: Map<string, ItemExtended | null | undefined> = new Map();

/**
 * Returns the item from an Unique Identifier
 * @param uuid
 * @returns
 */
export async function findItemFromUUID(uuid: string) {
	if (baseItems.has(uuid)) {
		const item = baseItems.get(uuid);
		if (item === undefined)
			return new Promise<ItemExtended | null>((resolve) => {
				Hooks.on('retrieveBaseItem', function check(item: ItemExtended | null, findUuid: string) {
					if (findUuid === uuid) {
						Hooks.off('retrieveBaseItem', this);
						resolve(item);
					}
				});
			});
	}

	baseItems.set(uuid, undefined);
	const item = (await fromUuid(uuid)) as ItemExtended | null;
	baseItems.set(uuid, item);
	Hooks.callAll('retrieveBaseItem', item, uuid);
	return item;
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
