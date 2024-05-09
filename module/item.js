import { getFlag } from './flags.js';
import { MODULE_ID, getSetting } from './settings.js';
import { keepPropertiesOverride } from './system.js';
import { deletionKeys, isPrimaryItem } from './utils.js';

/**
 * Finds and lists all linked items in the game.
 * @returns {Object} An object containing the frequency of derived items, grouped by base item UUID.
 */
export function findDerived() {
	const items = game.items.contents;
	const tokens = game.scenes.contents
		.map((s) => s.tokens.contents.filter((t) => t.isLinked === false && t.actor).map((t) => t.actor))
		.flat();
	const embedded = [...game.actors.values(), ...tokens]
		.map((a) => a.items.contents)
		.flat()
		.filter(Boolean);
	const frequency = {};
	[...items, ...embedded].forEach((i) => {
		if (!getFlag(i, 'isLinked')) return;
		const baseItemUuid = getFlag(i, 'baseItem');
		if (!baseItemUuid) return;
		if (!isPrimaryItem(i)) return;
		if (!frequency[baseItemUuid]) frequency[baseItemUuid] = [];
		frequency[baseItemUuid].push(i);
	});
	return frequency;
}

/**
 * Returns an array of properties to keep when linking an item.
 * "Kept" properties are not inherited from the base item.
 * @param {boolean} keepEmbedded - Whether to keep embedded properties.
 * @param {Item} item - The item to keep properties for.
 * @returns {string[]} - The array of properties to keep.
 */
function getKeepProperties(keepEmbedded, item) {
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
		...keepPropertiesOverride(item),
		...additional,
		...(exceptions !== '' ? exceptions.split(',') : []),
		...(keepEmbedded ? Object.values(CONFIG.Item.documentClass.metadata.embedded) : []),
	];
}

/**
 * Removes properties from the given object that are specified in the `keys` array.
 * @param {Object} changes - The object from which properties will be removed.
 * @param {string[]} keys - The array of property keys to be removed.
 * @returns {Object} - The modified object with removed properties.
 */
function removeKeepProperties(changes, keys) {
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

/**
 * Creates changes between two item data objects.
 * @param {object} itemData - The current item data object.
 * @param {object} baseItemData - The base item data object to compare against.
 * @param {boolean} [ignoreEmbedded=true] - Whether to ignore embedded entities when comparing.
 * @returns {object} - The changes between the two item data objects.
 */
export function createChanges(itemData, baseItemData, ignoreEmbedded = true) {
	const source = removeKeepProperties(foundry.utils.deepClone(itemData), getKeepProperties(true, itemData));
	const baseItemSource = removeKeepProperties(
		foundry.utils.deepClone(baseItemData),
		getKeepProperties(ignoreEmbedded, itemData)
	);
	const diff = foundry.utils.diffObject(source, baseItemSource);
	const deletions = deletionKeys(source, baseItemSource);
	return mergeObject(deletions, diff);
}

/**
 * Updates an item with the given changes.
 * @param {object} item - The item to be updated.
 * @param {object} changes - The changes to be applied to the item.
 */
function updateItem(item, changes) {
	if (!changes.flags?.[MODULE_ID]) return;
	if (item.sheet && item.sheet.constructor.name === 'Tidy5eKgarItemSheet') {
		if (item.sheet.rendered) item.sheet.render(true);
	}
	if (!item.compendium) {
		Object.values(ui.windows).forEach((app) => {
			if (app instanceof Compendium) app.render();
		});
		return;
	}
}

/**
 * Performs pre-update operations on an item, making sure the item
 * is properly linked to its base item and that changes are properly
 * inherited from the base item.
 * @param {Item} item - The item being updated.
 * @param {object} changes - The changes being made to the item.
 * @param {object} options - Additional options for the update.
 * @returns {boolean} - Returns false if the update should be cancelled.
 */
function preUpdateItem(item, changes, options) {
	const linked = changes.flags?.[MODULE_ID]?.isLinked ?? getFlag(item, 'isLinked');
	const baseItemId = changes.flags?.[MODULE_ID]?.baseItem ?? getFlag(item, 'baseItem');
	const linkedUpdate = options?.linkedUpdate ?? false;
	if (linkedUpdate === false && linked === true && changes.flags?.[MODULE_ID]) {
		if (!item.compendium || item.isEmbedded) {
			fromUuid(baseItemId)
				.then((baseItem) => {
					const data = deepClone(item._source);
					if (changes.flags?.[MODULE_ID]?.overrideOwnerUser !== undefined) {
						setProperty(data, `flags.${MODULE_ID}.overrideOwnerUser`, changes.flags[MODULE_ID].overrideOwnerUser);
					}
					if (changes.flags?.[MODULE_ID]?.linkPropertyExceptions !== undefined) {
						setProperty(
							data,
							`flags.${MODULE_ID}.linkPropertyExceptions`,
							changes.flags[MODULE_ID].linkPropertyExceptions
						);
					}
					const addChanges = baseItem ? createChanges(data, baseItem._source) : {};
					mergeObject(changes, addChanges);
					const exceptions = getSetting('linkPropertyExceptions').split(',');
					Object.entries(CONFIG.Item.documentClass.metadata.embedded).forEach(([collectionName, collection]) => {
						if (exceptions.includes(collection)) return;
						const itemIds = item._source[collection].map((fx) => fx._id);
						const baseIds = baseItem?._source[collection].map((fx) => fx._id) ?? [];
						const createIds = baseIds.filter((id) => !itemIds.includes(id));
						const updateIds = baseIds.filter((id) => itemIds.includes(id));
						const deleteIds = itemIds.filter((id) => !baseIds.includes(id));
						if (createIds.length) {
							const data = createIds.map((id) => baseItem._source[collection].find((fx) => fx._id === id));
							data.forEach((d) => {
								if ('origin' in d) d.origin = item.uuid;
							});
							item.createEmbeddedDocuments(collectionName, data, { keepId: true });
							if (getSetting('enforceActorsFXs') && item.parent instanceof CONFIG.Actor.documentClass) {
								item.parent.createEmbeddedDocuments(collectionName, data, { keepId: true });
							}
						}
						if (updateIds.length) {
							const data = updateIds.map((id) => baseItem._source[collection].find((fx) => fx._id === id));
							data.forEach((d) => {
								if ('origin' in d) d.origin = item.uuid;
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
					if (Object.keys(changes).length === 0) return;
					item.update(changes, { linkedUpdate: true });
				})
				.catch((er) => {
					item.update(changes, { linkedUpdate: true });
				});
			const srcFlags = item._source.flags['item-linking'];
			if (srcFlags) {
				if (!('item-linking' in item.flags)) delete item._source.flags['item-linking'];
				else {
					if ('isLinked' in srcFlags && !('isLinked' in item.flags['item-linking'])) delete srcFlags.isLinked;
					if ('baseItem' in srcFlags && !('baseItem' in item.flags['item-linking'])) delete srcFlags.baseItem;
				}
			}
			return false;
		}
		setProperty(changes, `flags.${MODULE_ID}`, {
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
		derived?.forEach((derivation) =>
			derivation.update(
				{
					...createChanges(derivation._source, item._source),
					...removeKeepProperties(derived_changes, getKeepProperties(true, derivation._source)),
				},
				{ linkedUpdate: true }
			)
		);
	}
}

/**
 * Updates the compendium for the given item.
 * @param {Item} item - The item to update the compendium for.
 */
function updateCompendium(item) {
	const baseItemId = getFlag(item, 'baseItem');
	if (getFlag(item, 'isLinked') && baseItemId) {
		fromUuid(baseItemId).then((item) => {
			if (item) item.compendium.render();
		});
	}
}

/** -------------------------------------------- */
Hooks.on('preUpdateItem', preUpdateItem);
Hooks.on('updateItem', updateItem);
Hooks.on('createItem', updateCompendium);
Hooks.on('deleteItem', updateCompendium);

