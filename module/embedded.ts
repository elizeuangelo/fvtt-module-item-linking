import { findDerived } from './item.js';
import { getSetting } from './settings.js';

function preUpdate(document: ActiveEffect, changes) {
	if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = (document.constructor as any).metadata.name;
	derived.forEach((derivation) => {
		// Creates the ActiveFX for the Actor
		if (derivation.parent instanceof CONFIG.Actor.documentClass) {
			if (getSetting('enforceActorsFXs')) {
				derivation.parent.updateEmbeddedDocuments(collectionName, [changes]);
			}
		} else derivation.updateEmbeddedDocuments(collectionName, [changes]);
	});
}

function preCreate(document: ActiveEffect, data, context) {
	if (!document.isEmbedded) return;
	if (getSetting('enforceActorsFXs') && document.parent instanceof CONFIG.Actor.documentClass) context.keepId = true;
	if (!(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = (document.constructor as any).metadata.name;

	const id = randomID();
	document._source._id = data._id = id;
	context.keepId = true;
	derived.forEach((derivation) => {
		const new_data = deepClone(data);
		new_data.origin = derivation.uuid;
		// Creates the ActiveFX for the Actor
		if (derivation.parent instanceof CONFIG.Actor.documentClass) {
			if (getSetting('enforceActorsFXs'))
				derivation.parent.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
		} else derivation.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
	});
}

function preDelete(document: ActiveEffect) {
	if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];

	const collectionName = (document.constructor as any).metadata.name;
	derived.forEach((derivation) => {
		// Deletes the ActiveFX for the Actor
		if (derivation.parent instanceof CONFIG.Actor.documentClass) {
			if (getSetting('enforceActorsFXs')) derivation.parent.deleteEmbeddedDocuments(collectionName, [document.id!]);
		} else derivation.deleteEmbeddedDocuments(collectionName, [document.id!]);
	});
}

/** -------------------------------------------- */
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
	Hooks.on(`preUpdate${type}`, preUpdate);
	Hooks.on(`preCreate${type}`, preCreate);
	Hooks.on(`preDelete${type}`, preDelete);
});
