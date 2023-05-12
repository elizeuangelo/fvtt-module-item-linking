import { findDerived } from './item.js';

function preUpdate(document: ActiveEffect, changes) {
	if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	Object.entries(CONFIG.Item.documentClass.metadata.embedded);
	const collectionName = (document.constructor as any).metadata.name;
	derived.forEach((derivation) => {
		derivation.updateEmbeddedDocuments(collectionName, [changes]);
	});
}

function preCreate(document: ActiveEffect, data, context) {
	if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	Object.entries(CONFIG.Item.documentClass.metadata.embedded);
	const collectionName = (document.constructor as any).metadata.name;

	const id = randomID();
	document._source._id = data._id = id;
	context.keepId = true;
	derived.forEach((derivation) => {
		derivation.createEmbeddedDocuments(collectionName, [data], { keepId: true });
	});
}

function preDelete(document: ActiveEffect) {
	if (!document.isEmbedded || !(document.parent instanceof CONFIG.Item.documentClass) || !document.compendium) return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	Object.entries(CONFIG.Item.documentClass.metadata.embedded);
	const collectionName = (document.constructor as any).metadata.name;
	derived.forEach((derivation) => {
		derivation.deleteEmbeddedDocuments(collectionName, [document.id!]);
	});
}

/** -------------------------------------------- */
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
	Hooks.on(`preUpdate${type}`, preUpdate);
	Hooks.on(`preCreate${type}`, preCreate);
	Hooks.on(`preDelete${type}`, preDelete);
});
