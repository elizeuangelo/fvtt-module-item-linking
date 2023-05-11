import { getFlag } from './flags.js';
import { findItemFromUUID } from './packs.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';

export const derivations: Map<ItemExtended, ItemExtended> = new Map();
export const derivationsIds: Set<string> = new Set();
let original;

function findDerived(itemCompendium: ItemExtended) {
	const registry = [...derivations.entries()];
	return registry.filter(([k, v]) => v === itemCompendium);
}

function updateItem(item, changes) {
	if (!item.compendium) {
		if (changes.flags?.[MODULE]?.isLinked === false) {
			const baseItem = derivations.get(item);
			derivations.delete(item);
			derivationsIds.delete(item.id);
			baseItem?.compendium.render();
		}
		return;
	}
	const derived = findDerived(item);

	// Updates Every Item Related to the UUID
	derived.forEach(async ([derivation]) => {
		prepareItemFromBaseItem(derivation, item);
		derivation.parent?.sheet?.render();
		derivation.sheet?.render();
	});

	ui.sidebar.tabs.items!.render();
}

function prepareItemFromBaseItem(item: ItemExtended, baseItem: ItemExtended, oldBaseItem?: ItemExtended) {
	const system = flattenObject(baseItem.system);
	Object.keys(system).forEach((k) => {
		if (KEEP_PROPERTIES.includes(k)) delete system[k];
	});
	mergeObject(item.system, system);

	// Embedded Items
	const embeddedTypes = (item.constructor as any).metadata.embedded || {};
	for (const collectionName of Object.values(embeddedTypes) as string[]) {
		item[collectionName].clear();
		for (const [key, value] of baseItem[collectionName].entries()) {
			item[collectionName].set(key, value);
		}
	}

	// Link Header is configured so
	if (getSetting('linkHeader')) {
		item.name = baseItem.name;
		item.img = baseItem.img;
	}

	if (item.id && item.id !== baseItem.id && (item.parent === null || item.parent.id !== null)) {
		//if (!derivationsIds.has(item.id!)) {
		derivations.set(item, baseItem);
		oldBaseItem?.compendium.render();
		derivationsIds.add(item.id!);
		baseItem.compendium.render();
		//}
	}
}

function prepareDerivedData() {
	original.call(this);

	const baseItemId = getFlag(this, 'baseItem');
	if (getFlag(this, 'isLinked') !== true || !baseItemId) return;

	const prepare = (baseItem) => {
		prepareItemFromBaseItem(this, baseItem, oldBaseItem);
		if (this.sheet?.rendered) this.sheet.render(true);
	};

	const oldBaseItem = derivations.get(this);

	if (oldBaseItem?.uuid === baseItemId) {
		prepare(derivations.get(this));
	} else
		findItemFromUUID(baseItemId).then((baseItem) => {
			if (baseItem) prepare(baseItem);
		});
}

function preUpdateItem(item: ItemExtended, changes: any) {
	const linked = changes.flags?.[MODULE]?.isLinked;
	const baseItemId = changes.flags?.[MODULE]?.baseItem;
	if (linked === false || baseItemId) {
		const updates: Record<string, any> = {
			system: item.system,
		};

		// Embedded Items
		const oldBaseItem = derivations.get(item);
		if (linked === false && oldBaseItem) {
			const embeddedTypes = (item.constructor as any).metadata.embedded || {};
			for (const collectionName of Object.values(embeddedTypes) as string[]) {
				updates[collectionName] = oldBaseItem._source[collectionName];
			}
		}

		const base = fromUuidSync(baseItemId ?? getFlag(item, 'baseItem'));
		if (getSetting('linkHeader') && base) {
			updates.name = base.name!;
			updates.img = base.img!;
			changes.name = base.name;
			changes.img = base.img;
		}
		mergeObject(item._source, updates);
		//item.updateSource(updates);
	}
}

export function deleteItem(item: ItemExtended) {
	const baseItemId = getFlag(item, 'baseItem');
	if (getFlag(item, 'isLinked') && baseItemId) {
		derivationsIds.delete(item.id!);
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
