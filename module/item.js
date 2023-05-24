import { getFlag } from './flags.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';
import { deletionKeys } from './utils.js';
export function findDerived() {
    const items = game.items.contents;
    const tokens = game
        .scenes.contents.map((s) => s.tokens.contents.filter((t) => t.isLinked === false && t.actor).map((t) => t.actor))
        .flat();
    const embedded = [...game.actors.values(), ...tokens]
        .map((a) => a.items.contents)
        .flat()
        .filter(Boolean);
    const frequency = {};
    [...items, ...embedded].forEach((i) => {
        if (!getFlag(i, 'isLinked'))
            return;
        const baseItemUuid = getFlag(i, 'baseItem');
        if (!baseItemUuid)
            return;
        if (!frequency[baseItemUuid])
            frequency[baseItemUuid] = [];
        frequency[baseItemUuid].push(i);
    });
    return frequency;
}
function getKeepProperties() {
    const additional = getSetting('linkHeader') ? [] : ['name', 'img'];
    return [`flags`, '_id', '_stats', 'ownership', 'folder', 'sort', ...KEEP_PROPERTIES, ...additional];
}
function removeKeepProperties(changes, keys = getKeepProperties()) {
    keys.forEach((key) => {
        const ps = key.split('.');
        let target = changes;
        ps.forEach((p, idx) => {
            const t = getType(target);
            if (!(t === 'Object' || t === 'Array'))
                return;
            if (p in target) {
                if (idx + 1 === ps.length)
                    delete target[p];
                else
                    target = target[p];
            }
            else
                return;
        });
    });
    return changes;
}
function createChanges(item, baseItem) {
    const source = removeKeepProperties(foundry.utils.deepClone(item._source));
    const baseItemSource = removeKeepProperties(foundry.utils.deepClone(baseItem._source));
    const diff = foundry.utils.diffObject(source, baseItemSource);
    const deletions = deletionKeys(source, baseItemSource);
    return mergeObject(deletions, diff);
}
function updateItem(item, changes) {
    if (!item.compendium) {
        if (changes.flags?.[MODULE]) {
            Object.values(ui.windows).forEach((app) => {
                if (app instanceof Compendium)
                    app.render();
            });
        }
        return;
    }
}
function preUpdateItem(item, changes, options) {
    const linked = changes.flags?.[MODULE]?.isLinked ?? getFlag(item, 'isLinked');
    const baseItemId = changes.flags?.[MODULE]?.baseItem ?? getFlag(item, 'baseItem');
    const linkedUpdate = options?.linkedUpdate ?? false;
    if (linkedUpdate === false && linked === true) {
        if (!item.compendium) {
            fromUuid(baseItemId)
                .then((baseItem) => {
                const addChanges = baseItem ? createChanges(item, baseItem) : {};
                mergeObject(changes, addChanges);
                Object.entries(CONFIG.Item.documentClass.metadata.embedded).forEach(([collectionName, collection]) => {
                    const keepIds = baseItem?._source[collection].map((fx) => fx._id) ?? [];
                    const deleteIds = (item.parent?._source ?? item._source)[collection]
                        .filter((fx) => !keepIds.includes(fx._id))
                        .map((fx) => fx._id);
                    if (deleteIds.length) {
                        const primaryDoc = item.parent ?? item;
                        if (!item.parent || getSetting('enforceActorsFXs'))
                            primaryDoc.deleteEmbeddedDocuments(collectionName, deleteIds);
                    }
                    if (item.isEmbedded) {
                        if (getSetting('enforceActorsFXs')) {
                            const new_data = (deepClone(baseItem?._source[collection]) ?? []).filter((fx) => !item.parent[collection].get(fx._id));
                            new_data.forEach((source) => (source.origin = item.uuid));
                            item.parent.createEmbeddedDocuments(collectionName, new_data, { keepId: true });
                        }
                        delete changes[collection];
                    }
                });
                if (Object.keys(changes).length === 0)
                    return;
                item.update(changes, { linkedUpdate: true });
            })
                .catch((er) => {
                item.update(changes, { linkedUpdate: true });
            });
            return false;
        }
        setProperty(changes, `flags.${MODULE}`, {
            baseItem: null,
            isLinked: false,
        });
    }
    if (item.compendium) {
        const derived = findDerived()[item.uuid];
        const derived_changes = deepClone(changes);
        if (derived_changes.uses?.max === '') {
            derived_changes.uses.value = null;
        }
        derived.map((derivation) => derivation.update({ ...createChanges(derivation, item), ...removeKeepProperties(derived_changes) }, { linkedUpdate: true }));
    }
}
function updateCompendium(item) {
    const baseItemId = getFlag(item, 'baseItem');
    if (getFlag(item, 'isLinked') && baseItemId) {
        fromUuid(baseItemId).then((item) => {
            if (item)
                item.compendium.render();
        });
    }
}
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.on('createItem', updateCompendium);
Hooks.on('deleteItem', updateCompendium);
