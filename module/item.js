import { getFlag } from './flags.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';
import { deletionKeys, isPrimaryItem } from './utils.js';
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
        if (!isPrimaryItem(i))
            return;
        if (!frequency[baseItemUuid])
            frequency[baseItemUuid] = [];
        frequency[baseItemUuid].push(i);
    });
    return frequency;
}
function getKeepProperties(keepEmbedded = true) {
    const additional = getSetting('linkHeader') ? [] : ['name', 'img'];
    const exceptions = getSetting('linkPropertyExceptions');
    return [
        'flags.item-linking',
        'flags.beavers-crafting',
        '_id',
        '_stats',
        'ownership',
        'folder',
        'sort',
        ...KEEP_PROPERTIES,
        ...additional,
        ...(exceptions !== '' ? exceptions.split(',') : []),
        ...(keepEmbedded ? Object.values(CONFIG.Item.documentClass.metadata.embedded) : []),
    ];
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
export function createChanges(itemData, baseItemData, ignoreEmbedded = true) {
    const source = removeKeepProperties(foundry.utils.deepClone(itemData));
    const baseItemSource = removeKeepProperties(foundry.utils.deepClone(baseItemData), getKeepProperties(ignoreEmbedded));
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
    if (linkedUpdate === false && linked === true && (changes.flags?.[MODULE]?.isLinked || changes.flags?.[MODULE]?.baseItem)) {
        if (!item.compendium || item.isEmbedded) {
            fromUuid(baseItemId)
                .then((baseItem) => {
                const addChanges = baseItem ? createChanges(item._source, baseItem._source) : {};
                mergeObject(changes, addChanges);
                Object.entries(CONFIG.Item.documentClass.metadata.embedded).forEach(([collectionName, collection]) => {
                    const itemIds = item._source[collection].map((fx) => fx._id);
                    const baseIds = baseItem?._source[collection].map((fx) => fx._id) ?? [];
                    const createIds = baseIds.filter((id) => !itemIds.includes(id));
                    const updateIds = baseIds.filter((id) => itemIds.includes(id));
                    const deleteIds = itemIds.filter((id) => !baseIds.includes(id));
                    if (createIds.length) {
                        const data = createIds.map((id) => baseItem._source[collection].find((fx) => fx._id === id));
                        data.forEach((d) => {
                            if ('origin' in d)
                                d.origin = item.uuid;
                        });
                        item.createEmbeddedDocuments(collectionName, data, { keepId: true });
                        if (getSetting('enforceActorsFXs') && item.parent instanceof CONFIG.Actor.documentClass) {
                            item.parent.createEmbeddedDocuments(collectionName, data, { keepId: true });
                        }
                    }
                    if (updateIds.length) {
                        const data = updateIds.map((id) => baseItem._source[collection].find((fx) => fx._id === id));
                        data.forEach((d) => {
                            if ('origin' in d)
                                d.origin = item.uuid;
                        });
                        item.updateEmbeddedDocuments(collectionName, data);
                        if (getSetting('enforceActorsFXs') && item.parent instanceof CONFIG.Actor.documentClass) {
                            item.parent.updateEmbeddedDocuments(collectionName, data);
                        }
                    }
                    if (deleteIds.length) {
                        item.deleteEmbeddedDocuments(collectionName, deleteIds);
                        if (getSetting('enforceActorsFXs') && item.parent instanceof CONFIG.Actor.documentClass) {
                            item.parent.deleteEmbeddedDocuments(collectionName, deleteIds);
                        }
                    }
                });
                if (Object.keys(changes).length === 0)
                    return;
                item.update(changes, { linkedUpdate: true });
            })
                .catch((er) => {
                item.update(changes, { linkedUpdate: true });
            });
            const srcFlags = item._source.flags['item-linking'];
            if (srcFlags) {
                if (!('item-linking' in item.flags))
                    delete item._source.flags['item-linking'];
                else {
                    if ('isLinked' in srcFlags && !('isLinked' in item.flags['item-linking']))
                        delete srcFlags.isLinked;
                    if ('baseItem' in srcFlags && !('baseItem' in item.flags['item-linking']))
                        delete srcFlags.baseItem;
                }
            }
            return false;
        }
        setProperty(changes, `flags.${MODULE}`, {
            baseItem: null,
            isLinked: false,
        });
    }
    if (item.compendium && !item.isEmbedded) {
        const derived = findDerived()[item.uuid];
        const derived_changes = deepClone(changes);
        if (derived_changes.uses?.max === '') {
            derived_changes.uses.value = null;
        }
        derived.forEach((derivation) => derivation.update({ ...createChanges(derivation._source, item._source), ...removeKeepProperties(derived_changes) }, { linkedUpdate: true }));
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
