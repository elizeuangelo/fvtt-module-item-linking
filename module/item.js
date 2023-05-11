import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';
export const derivations = new Map();
let original;
function findDerived(itemCompendium) {
    const registry = [...derivations.entries()];
    return registry.filter(([k, v]) => v === itemCompendium);
}
function updateItem(item, changes) {
    if (!item.compendium) {
        if (changes.flags?.[MODULE]?.isLinked === false) {
            const baseItem = derivations.get(item);
            derivations.delete(item);
            baseItem?.compendium.render();
        }
        return;
    }
    const derived = findDerived(item);
    derived.forEach(async ([derivation]) => {
        prepareItemFromBaseItem(derivation, item);
        derivation.parent?.sheet?.render();
        derivation.sheet?.render();
    });
    ui.sidebar.tabs.items.render();
}
function prepareItemFromBaseItem(item, baseItem, oldBaseItem) {
    const system = flattenObject(baseItem.system);
    Object.keys(system).forEach((k) => {
        if (KEEP_PROPERTIES.includes(k))
            delete system[k];
    });
    mergeObject(item.system, system);
    const embeddedTypes = item.constructor.metadata.embedded || {};
    for (const collectionName of Object.values(embeddedTypes)) {
        item[collectionName].clear();
        for (const [key, value] of baseItem[collectionName].entries()) {
            item[collectionName].set(key, value);
        }
    }
    if (getSetting('linkHeader')) {
        item.name = baseItem.name;
        item.img = baseItem.img;
    }
    if (item.id && item.id !== baseItem.id && (item.parent === null || item.parent.id !== null)) {
        derivations.set(item, baseItem);
        oldBaseItem?.compendium.render();
        baseItem.compendium.render();
    }
}
function prepareDerivedData() {
    original.call(this);
    const baseItemId = getFlag(this, 'baseItem');
    if (getFlag(this, 'isLinked') !== true || !baseItemId)
        return;
    const prepare = (baseItem) => {
        prepareItemFromBaseItem(this, baseItem, oldBaseItem);
        if (this.sheet?.rendered)
            this.sheet.render(true);
    };
    const oldBaseItem = derivations.get(this);
    if (oldBaseItem?.uuid === baseItemId) {
        prepare(derivations.get(this));
    }
    else
        findItemFromUUID(baseItemId).then((baseItem) => {
            if (baseItem)
                prepare(baseItem);
        });
}
function preUpdateItem(item, changes) {
    const linked = changes.flags?.[MODULE]?.isLinked;
    const baseItemId = changes.flags?.[MODULE]?.baseItem;
    if (linked === false || baseItemId) {
        const updates = {
            system: item.system,
        };
        const oldBaseItem = derivations.get(item);
        if (linked === false && oldBaseItem) {
            const embeddedTypes = item.constructor.metadata.embedded || {};
            for (const collectionName of Object.values(embeddedTypes)) {
                updates[collectionName] = oldBaseItem._source[collectionName];
            }
        }
        const base = fromUuidSync(baseItemId ?? getFlag(item, 'baseItem'));
        if (getSetting('linkHeader') && base) {
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
