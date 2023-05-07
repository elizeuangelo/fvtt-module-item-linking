import { findCompendiumFromItemID } from './packs.js';
import { MODULE } from './settings.js';
export function getFlag(item, name) {
    return item.getFlag(MODULE, name);
}
export function setFlag(item, name, value) {
    return game.settings.set(MODULE, name, value);
}
function preCreateItem(item) {
    const moduleFlags = {
        baseItem: null,
        isLinked: false,
    };
    const isLinked = item._source.flags?.['item-linking']?.isLinked;
    const isCompendium = Boolean(item.compendium);
    if (isCompendium === false && item.id) {
        if (isLinked)
            mergeObject(moduleFlags, item._source.flags['item-linking']);
        else {
            const compendium = findCompendiumFromItemID(item.id);
            if (compendium) {
                moduleFlags.baseItem = 'Compendium.' + compendium.metadata.id + '.' + item.id;
                moduleFlags.isLinked = true;
            }
        }
    }
    item.updateSource({ 'flags.item-linking': moduleFlags });
}
Hooks.on('preCreateItem', preCreateItem);
