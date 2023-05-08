import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';

export const derivations: Map<ItemExtended, string> = new Map();
let original;

function findDerived(itemCompendiumUUID: string) {
	const registry = [...derivations.entries()];
	return registry.filter(([k, v]) => v === itemCompendiumUUID);
}

function updateItem(item) {
	if (!item.compendium) {
		return;
	}
	const derived = findDerived(item.uuid);

	// Updates Every Item Related to the UUID
	derived.forEach(async ([derivation]) => {
		if (derivation === null) return derivations.delete(derivation);
		prepareItemFromBaseItem(derivation, item);
		derivation.sheet?.render();
	});

	ui.sidebar.tabs.items!.render();
}

function prepareItemFromBaseItem(item: ItemExtended, baseItem: ItemExtended) {
	const system = foundry.utils.deepClone(baseItem._source.system);
	const keep = KEEP_PROPERTIES;
	if (keep !== undefined) {
		const map = Object.fromEntries(keep.map((k) => [k, foundry.utils.getProperty(item._source.system, k)]));
		mergeObject(system, map);
	}
	item.system = system;

	// Link Header is configured so
	if (getSetting('linkHeader')) {
		item.name = baseItem.name;
		item.img = baseItem.img;
	}

	if (item.id !== baseItem.id) derivations.set(item, baseItem.uuid);
}

function prepareDerivedData() {
	original.call(this);
	if (getFlag(this, 'isLinked') !== true || !getFlag(this, 'baseItem')) return;

	findItemFromUUID(getFlag(this, 'baseItem')!).then((baseItem) => {
		if (baseItem === null) return;
		prepareItemFromBaseItem(this, baseItem);
		if (this.sheet?.rendered) this.sheet.render(true);
	});
}

function preUpdateItem(item: ItemExtended, changes: any) {
	if (changes.flags?.[MODULE].isLinked === false || changes.flags?.[MODULE].baseItem) {
		const updates: { system: any; name?: string; img?: string } = { system: item.system };
		if (getSetting('linkHeader')) {
			const base = fromUuidSync(changes.flags?.[MODULE].baseItem ?? getFlag(item, 'baseItem')) ?? item;
			updates.name = base.name!;
			updates.img = base.img!;
			changes.name = base.name;
			changes.img = base.img;
		}
		item.updateSource(updates);
	}
}

function deleteItem(item: ItemExtended) {
	const baseItemId = getFlag(item, 'baseItem');
	if (getFlag(item, 'isLinked') && baseItemId) {
		derivations.delete(item);
		findItemFromUUID(baseItemId).then((item) => {
			if (item) item.compendium.render();
		});
	}
}

function createItem(item) {
	const baseItemId = getFlag(item, 'baseItem');
	if (getFlag(item, 'isLinked') && baseItemId) {
		findItemFromUUID(baseItemId).then((item) => {
			if (item) item.compendium.render();
		});
	}
}

/** -------------------------------------------- */
Hooks.on('createItem', createItem);
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.on('deleteItem', deleteItem);
Hooks.once('setup', () => {
	original = CONFIG.Item.documentClass.prototype.prepareDerivedData;
	CONFIG.Item.documentClass.prototype.prepareDerivedData = prepareDerivedData;
});
