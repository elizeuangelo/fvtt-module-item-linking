import { getFlag } from './flags.js';
import { findDerived } from './item.js';
import { getSetting } from './settings.js';

function isFirstItem(i: ItemExtended) {
	if (!(i.parent instanceof CONFIG.Actor.documentClass) || !getFlag(i, 'isLinked')) return false;
	const baseItem = getFlag(i, 'baseItem');
	return i.parent.items.find((i2) => getFlag(i2, 'isLinked') && baseItem === getFlag(i, 'baseItem')) === i;
}

function preCreate(document: ActiveEffect, data, context) {
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

	// Creates the Unique ID
	document._source._id = data._id = randomID();
	context.keepId = true;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = (document.constructor as any).metadata.name;

	derived.forEach((derivation) => {
		const new_data = deepClone(data);
		new_data.origin = derivation.uuid;
		derivation.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });

		// Creates the ActiveFX for the Actor
		if (getSetting('enforceActorsFXs') && isFirstItem(derivation)) {
			derivation.parent!.createEmbeddedDocuments(collectionName, [new_data], { keepId: true });
		}
	});
}

function preUpdate(document: ActiveEffect, changes) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	)
		return;

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];
	const collectionName = (document.constructor as any).metadata.name;

	derived.forEach((derivation) => {
		const new_changes = deepClone(changes);
		derivation.updateEmbeddedDocuments(collectionName, [new_changes]);

		// Creates the ActiveFX for the Actor
		if (getSetting('enforceActorsFXs') && derivation.parent instanceof CONFIG.Actor.documentClass) {
			const fx = derivation.parent!.effects.get(changes._id);
			if (fx?.origin === derivation.uuid) derivation.parent.updateEmbeddedDocuments(collectionName, [new_changes]);
		}
	});
}

function preDelete(document: ActiveEffect) {
	if (
		!document.isEmbedded ||
		!(document.parent instanceof CONFIG.Item.documentClass) ||
		!document.compendium ||
		document.parent.isEmbedded
	) {
		if (document.parent instanceof CONFIG.Actor.documentClass && 'origin' in document && getSetting('enforceActorsFXs')) {
			const existsInOther = document.parent.items.contents.find((i) => i.effects.find((fx) => fx.id === document.id));
			if (existsInOther) {
				document.update({ origin: existsInOther.uuid });
				return false;
			}
		}
		return;
	}

	// Updates Every Derivation Related to the Item
	const item = document.parent;
	const derived = findDerived()[item.uuid];

	const collectionName = (document.constructor as any).metadata.name;
	derived.forEach((derivation) => {
		derivation.deleteEmbeddedDocuments(collectionName, [document.id!]);

		// Deletes the ActiveFX for the Actor
		if (getSetting('enforceActorsFXs') && derivation.parent instanceof CONFIG.Actor.documentClass) {
			const fx = derivation.parent!.effects.get(document.id!);
			if (fx?.origin === derivation.uuid)
				setTimeout(() => derivation.parent!.deleteEmbeddedDocuments(collectionName, [document.id!]), 1000);
		}
	});
}

/** -------------------------------------------- */
Object.keys(CONFIG.Item.documentClass.metadata.embedded).forEach((type) => {
	Hooks.on(`preCreate${type}`, preCreate);
	Hooks.on(`preUpdate${type}`, preUpdate);
	Hooks.on(`preDelete${type}`, preDelete);
});
