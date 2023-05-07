import { getFlag } from './flags.js';
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
export async function stringifyItem(item) {
    let baseItem = null;
    while (getFlag(item, 'baseItem') !== null) {
        baseItem = await findItemFromUUID(getFlag(item, 'baseItem'));
        if (baseItem === null)
            break;
        item = baseItem;
    }
    return item.uuid;
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
Hooks.on('renderCompendiumDirectory', getPacksByType);
