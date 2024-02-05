import { getFlag } from './flags.js';
import { findDerived } from './item.js';
import { getSetting } from './settings.js';

/**
 * Checks if the given item is the first linked item of its parent actor.
 * @param {Item} i - The item to check.
 * @returns {boolean} - True if the item is the first linked item, false otherwise.
 */
function isFirstItem(i) {
	if (!(i.parent instanceof CONFIG.Actor.documentClass) || !getFlag(i, 'isLinked')) return false;
	const baseItem = getFlag(i, 'baseItem');
	return i.parent.items.find((i2) => getFlag(i2, 'isLinked') && baseItem === getFlag(i, 'baseItem')) === i;
}

/**
 * If an embedded document is created on the base item, it also creates it on its derivations.
 * @param {Document} document - The document being created.
 * @param {object} data - The data for the document being created.
 * @param {object} context - The context object containing additional information.
 * @returns {boolean} Returns false if a condition is met, otherwise undefined.
 */
function preCreate(document, data, context) {
	if (getSetting('enforceActorsFXs') && document.parent instanceof CONFIG.Actor.documentClass) {
		if (document.parent.effects.get(data._id)) return false;
		context.keepId = true;
	}
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	)
		return;
	document._source._id = data._id = randomID();
	context.keepId = true;
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = document.constructor.metadata.name;
	derived.forEach((derivation) => {
		const new_data = deepClone(data);
		new_data.origin = derivation.uuid;
		derivation.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
		if (getSetting('enforceActorsFXs') && isFirstItem(derivation)) {
			derivation.parent.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
		}
	});
}

/**
 * Makes sure when the ActiveEffect is updated on the base item, its also updated on its derivations.
 * If Enforce Actors FXs is enabled, it also updates the ActiveEffect on the parent actor.
 * @param {Document} document - The embedded document being updated.
 * @param {object} changes - The changes being made to the embedded document.
 */
function preUpdate(document, changes) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	)
		return;
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = document.constructor.metadata.name;
	derived.forEach((derivation) => {
		const new_changes = deepClone(changes);
		derivation.updateEmbeddedDocuments(collectionName, [new_changes]);
		if (getSetting('enforceActorsFXs') && derivation.parent instanceof CONFIG.Actor.documentClass) {
			const fx = derivation.parent.effects.get(changes._id);
			if (fx?.origin === derivation.uuid) derivation.parent.updateEmbeddedDocuments(collectionName, [new_changes]);
		}
	});
}

/**
 * If an embedded document is removed from the base item, it also removes it from its derivations.
 * @param {Document} document - The document to be deleted.
 * @returns {boolean|undefined} - Returns `false` if the document is linked to other items, otherwise `undefined`.
 */
function preDelete(document) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	) {
		if (
			document.parent instanceof CONFIG.Actor.documentClass &&
			'origin' in document &&
			getSetting('enforceActorsFXs')
		) {
			const existsInOther = document.parent.items.contents.find((i) =>
				i.effects.find((fx) => fx.id === document.id)
			);
			if (existsInOther) {
				document.update({ origin: existsInOther.uuid });
				return false;
			}
		}
		return;
	}
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = document.constructor.metadata.name;
	derived.forEach((derivation) => {
		derivation.deleteEmbeddedDocuments(collectionName, [document.id]);
		if (getSetting('enforceActorsFXs') && derivation.parent instanceof CONFIG.Actor.documentClass) {
			const fx = derivation.parent.effects.get(document.id);
			if (fx?.origin === derivation.uuid)
				setTimeout(() => derivation.parent.deleteEmbeddedDocuments(collectionName, [document.id]), 1000);
		}
	});
}

/** -------------------------------------------- */
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
	Hooks.on(`preCreate${type}`, preCreate);
	Hooks.on(`preUpdate${type}`, preUpdate);
	Hooks.on(`preDelete${type}`, preDelete);
});

