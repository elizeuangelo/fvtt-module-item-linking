export function findItemFromUUID(uuid) {
    return fromUuid(uuid);
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
