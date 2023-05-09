import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';
export const derivations = new Map();
export const derivationsIds = new Set();
let original;
function findDerived(itemCompendiumUUID) {
    const registry = [...derivations.entries()];
    return registry.filter(([k, v]) => v === itemCompendiumUUID);
}
function updateItem(item, changes) {
    if (!item.compendium) {
        if (changes.flags?.[MODULE]?.isLinked === false) {
            derivations.delete(item);
            derivationsIds.delete(item.id);
        }
        const baseItemId = getFlag(item, 'baseItem');
        if (baseItemId) {
            findItemFromUUID(baseItemId).then((baseItem) => baseItem?.compendium.render());
        }
        return;
    }
    const derived = findDerived(item.uuid);
    derived.forEach(async ([derivation]) => {
        prepareItemFromBaseItem(derivation, item);
        derivation.parent?.sheet?.render();
        derivation.sheet?.render();
    });
    ui.sidebar.tabs.items.render();
}
function prepareItemFromBaseItem(item, baseItem) {
    const system = foundry.utils.deepClone(baseItem.system);
    const keep = KEEP_PROPERTIES;
    if (keep !== undefined) {
        const map = Object.fromEntries(keep.map((k) => [k, foundry.utils.getProperty(item.system, k)]));
        mergeObject(system, map);
    }
    item.system = system;
    if (getSetting('linkHeader')) {
        item.name = baseItem.name;
        item.img = baseItem.img;
    }
    if (item.id !== baseItem.id && (item.parent === null || item.parent.id !== null)) {
        if (!derivationsIds.has(item.id)) {
            derivations.set(item, baseItem.uuid);
            derivationsIds.add(item.id);
        }
    }
}
function prepareDerivedData() {
    original.call(this);
    if (getFlag(this, 'isLinked') !== true || !getFlag(this, 'baseItem'))
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
    if (changes.flags?.[MODULE]?.isLinked === false || changes.flags?.[MODULE]?.baseItem) {
        const updates = {
            system: item._source.system,
        };
        Object.keys(item.collections).forEach((k) => {
            updates[k] = item._source[k];
        });
        if (getSetting('linkHeader')) {
            const base = fromUuidSync(changes.flags?.[MODULE].baseItem ?? getFlag(item, 'baseItem')) ?? item;
            updates.name = base.name;
            updates.img = base.img;
            changes.name = base.name;
            changes.img = base.img;
        }
        item.updateSource(updates);
    }
}
export function deleteItem(item) {
    const baseItemId = getFlag(item, 'baseItem');
    if (getFlag(item, 'isLinked') && baseItemId) {
        derivationsIds.delete(item.id);
        derivations.delete(item);
        findItemFromUUID(baseItemId).then((item) => {
            if (item)
                item.compendium.render();
        });
    }
}
function createItem(item) {
    const baseItemId = getFlag(item, 'baseItem');
    if (getFlag(item, 'isLinked') && baseItemId) {
        findItemFromUUID(baseItemId).then((item) => {
            if (item)
                item.compendium.render();
        });
    }
}
Hooks.on('createItem', createItem);
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.on('deleteItem', deleteItem);
Hooks.once('setup', () => {
    original = CONFIG.Item.documentClass.prototype.prepareDerivedData;
    CONFIG.Item.documentClass.prototype.prepareDerivedData = prepareDerivedData;
});
