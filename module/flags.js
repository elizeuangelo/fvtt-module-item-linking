import { findCompendiumFromItemID } from './packs.js';
import { MODULE } from './settings.js';
export function getFlag(item, name) {
    return item.getFlag(MODULE, name);
}
export function setFlag(item, name, value) {
    return game.settings.set(MODULE, name, value);
}
function preCreateItem(item) {
    const baseFlags = {
        baseItem: null,
        isLinked: false,
        embedded: {},
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
Hooks.on('preCreateItem', preCreateItem);
