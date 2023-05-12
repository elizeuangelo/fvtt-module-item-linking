import { getFlag } from './flags.js';
import { MODULE, getSetting } from './settings.js';
import { KEEP_PROPERTIES } from './system.js';

export function findDerived() {
	const items = game.items!.contents;
	const tokens = game
		.scenes!.contents.map((s) => s.tokens.contents.filter((t) => t.isLinked === false).map((t) => t.actor))
		.flat();
	const embedded = [...game.actors!, ...tokens].map((a) => a!.items.contents).flat();
	const frequency: Record<string, ItemExtended[]> = {};
	[...items, ...embedded].forEach((i: ItemExtended) => {
		if (!getFlag(i, 'isLinked')) return;
		const baseItemUuid = getFlag(i, 'baseItem');
		if (!baseItemUuid) return;
		if (!frequency[baseItemUuid]) frequency[baseItemUuid] = [];
		frequency[baseItemUuid].push(i);
	});
	return frequency;
}

function getKeepProperties() {
	const additional = getSetting('linkHeader') ? ['name', 'img'] : [];
	return [`flags.${MODULE}`, ...KEEP_PROPERTIES, ...additional];
}

function removeKeepProperties(changes: Object, keys = getKeepProperties()) {
	keys.forEach((key) => {
		const ps = key.split('.');
		let target = changes;
		ps.forEach((p, idx) => {
			const t = getType(target);
			if (!(t === 'Object' || t === 'Array')) return;
			if (p in target) {
				if (idx + 1 === ps.length) delete target[p];
				else target = target[p];
			} else return;
		});
	});
	return changes;
}

function createChanges(item: ItemExtended, baseItem: ItemExtended) {
	const source = foundry.utils.deepClone(item._source);
	const diff = foundry.utils.diffObject(source, baseItem._source);
	return removeKeepProperties(diff);
}

function updateItem(item, changes) {
	if (!item.compendium) {
		if (changes.flags?.[MODULE]) {
			Object.values(ui.windows).forEach((app) => {
				if (app instanceof Compendium) app.render();
			});
		}
		return;
	}
}

function preUpdateItem(item: ItemExtended, changes: any, options: any) {
	const linked = changes.flags?.[MODULE]?.isLinked ?? getFlag(item, 'isLinked');
	const baseItemId = changes.flags?.[MODULE]?.baseItem ?? getFlag(item, 'baseItem');
	const linkedUpdate = options?.linkedUpdate ?? false;

	if (linkedUpdate === false && (linked === true || baseItemId)) {
		if (!item.compendium) {
			fromUuid(baseItemId).then((baseItem: ItemExtended | null) => {
				const addChanges = baseItem ? createChanges(item, baseItem) : {};
				item.update({ ...changes, ...addChanges }, { linkedUpdate: true });
			});

			return false;
		}

		setProperty(changes, `flags.${MODULE}`, {
			baseItem: null,
			isLinked: false,
		});
	}

	if (item.compendium) {
		// Updates Every Derivation Related to the Item
		const derived = findDerived()[item.uuid];
		derived.map((derivation) => derivation.update(createChanges(derivation, item), { linkedUpdate: true }));
	}
}

function updateCompendium(item) {
	const baseItemId = getFlag(item, 'baseItem');
	if (getFlag(item, 'isLinked') && baseItemId) {
		fromUuid(baseItemId).then((item: ItemExtended | null) => {
			if (item) item.compendium.render();
		});
	}
}

/** -------------------------------------------- */
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.on('createItem', updateCompendium);
Hooks.on('deleteItem', updateCompendium);
