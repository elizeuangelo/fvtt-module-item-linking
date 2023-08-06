import { getFlag } from './flags.js';
import { findDerived } from './item.js';
import { MODULE, getSetting } from './settings.js';
function preUpdate(document, changes) {
    if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium)
        return;
    const item = document.parent;
    const derived = findDerived()[item.uuid];
    const collectionName = document.constructor.metadata.name;
    derived.forEach((derivation) => {
        const new_changes = deepClone(changes);
        new_changes._id = getFlag(derivation, 'embedded')[changes._id];
        derivation.updateEmbeddedDocuments(collectionName, [new_changes]);
        if (getSetting('enforceActorsFXs') && document.transfer && derivation.parent instanceof CONFIG.Actor.documentClass) {
            derivation.parent.updateEmbeddedDocuments(collectionName, [new_changes]);
        }
    });
}
function preCreate(document, data, context) {
    if (!document.isEmbedded)
        return;
    if (getSetting('enforceActorsFXs') && document.parent instanceof CONFIG.Actor.documentClass)
        context.keepId = true;
    if (!(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium)
        return;
    const item = document.parent;
    const derived = findDerived()[item.uuid];
    const collectionName = document.constructor.metadata.name;
    const id = randomID();
    document._source._id = data._id = id;
    context.keepId = true;
    derived.forEach((derivation) => {
        const new_data = deepClone(data);
        new_data.origin = derivation.uuid;
        new_data._id = randomID();
        derivation.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
        derivation.update({ [`flags.${MODULE}.embedded.${id}`]: new_data._id });
        if (getSetting('enforceActorsFXs') && document.transfer && derivation.parent instanceof CONFIG.Actor.documentClass) {
            derivation.parent.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
        }
    });
}
function preDelete(document) {
    if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium)
        return;
    const item = document.parent;
    const derived = findDerived()[item.uuid];
    const collectionName = document.constructor.metadata.name;
    derived.forEach((derivation) => {
        derivation.update({ [`flags.${MODULE}.embedded.-=${document.id}`]: null }, { performDeletions: true });
        const id = derivation.flags[MODULE]?.embedded[document.id];
        if (!id)
            return;
        derivation.deleteEmbeddedDocuments(collectionName, [id]);
        if (getSetting('enforceActorsFXs') && document.transfer && derivation.parent instanceof CONFIG.Actor.documentClass) {
            derivation.parent.deleteEmbeddedDocuments(collectionName, [id]);
        }
    });
}
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
    Hooks.on(`preUpdate${type}`, preUpdate);
    Hooks.on(`preCreate${type}`, preCreate);
    Hooks.on(`preDelete${type}`, preDelete);
});
