export const baseItems = new Map();
export async function findItemFromUUID(uuid) {
    if (baseItems.has(uuid)) {
        const item = baseItems.get(uuid);
        if (item === undefined)
            return new Promise((resolve) => {
                Hooks.on('retrieveBaseItem', function check(item, findUuid) {
                    if (findUuid === uuid) {
                        Hooks.off('retrieveBaseItem', this);
                        resolve(item);
                    }
                });
            });
    }
    baseItems.set(uuid, undefined);
    const item = (await fromUuid(uuid));
    baseItems.set(uuid, item);
    Hooks.callAll('retrieveBaseItem', item, uuid);
    return item;
}
export function findCompendiumFromItemID(id) {
    for (const pack of PACKS) {
        const res = pack.index.get(id);
        if (res !== undefined)
            return pack;
    }
    return null;
}
export let PACKS = [];
function getPacksByType() {
    const type = 'Item';
    const packs = [];
    for (const pack of game.packs.values()) {
        if (pack.metadata.type === type)
            packs.push(pack);
    }
    return (PACKS = packs);
}
export function getItemsFromCompendiumsByType(compendium, type) {
    return compendium.index.filter((i) => i.type === type);
}
export function createUuidFromIndex(pack, itemId) {
    return `Compendium.${pack.metadata.id}.${itemId}`;
}
Hooks.on('renderCompendiumDirectory', getPacksByType);
