/**
 * Returns the item from an Unique Identifier
 * @param code
 * @returns
 */
export function findItem(code: string) {
	return fromUuid(code) as Promise<ItemExtended | null>;
}

/**
 * Creates an Unique Identifier for the Base Item
 * @param item
 * @returns
 */
export async function stringifyItem(item: ItemExtended) {
	let baseItem: ItemExtended | null = null;
	while (item.baseItem !== null) {
		baseItem = await findItem(item.baseItem);
		if (baseItem === null) break;
		item = baseItem;
	}
	return item.uuid;
}
