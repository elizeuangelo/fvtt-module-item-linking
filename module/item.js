import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';
export const derivations = {};
let original;
function findDerived(itemCompendiumUUID) {
    const registry = Object.entries(derivations);
    return registry.filter(([k, v]) => v === itemCompendiumUUID);
}
function updateItem(item) {
    if (!item.compendium)
        return;
    const derived = findDerived(item.uuid);
    derived.forEach(async ([k]) => {
        const derivation = await findItemFromUUID(k);
        if (derivation === null)
            return delete derivations[k];
        prepareItemFromBaseItem(derivation, item);
        if (derivation.sheet?.rendered)
            derivation.sheet.render(true);
    });
}
function prepareItemFromBaseItem(item, baseItem) {
    const system = foundry.utils.deepClone(baseItem._source.system);
    const keep = KEEP_PROPERTIES;
    if (keep !== undefined) {
        const map = Object.fromEntries(keep.map((k) => [k, foundry.utils.getProperty(item._source.system, k)]));
        mergeObject(system, map);
    }
    item.system = system;
    if (getSetting('linkHeader')) {
        item.name = baseItem.name;
        item.img = baseItem.img;
    }
    derivations[item.uuid] = baseItem.uuid;
}
function prepareDerivedData() {
    original.call(this);
    if (getFlag(this, 'isLinked') !== true)
        return;
    findItemFromUUID(getFlag(this, 'baseItem')).then((baseItem) => {
        if (baseItem === null)
            return;
        prepareItemFromBaseItem(this, baseItem);
        if (this.sheet?.rendered)
            this.sheet.render(true);
    });
}
function preUpdateItem(item, changes) {
    if (changes.flags?.[MODULE].isLinked === false) {
        const updates = { system: item.system };
        if (getSetting('linkHeader')) {
            updates.name = item.name;
            updates.img = item.img;
        }
        item.updateSource(updates);
    }
}
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.once('setup', () => {
    original = CONFIG.Item.documentClass.prototype.prepareDerivedData;
    CONFIG.Item.documentClass.prototype.prepareDerivedData = prepareDerivedData;
});
