import { getFlag } from './flags.js';
import { MODULE_ID } from './settings.js';
import { createChanges, filterUpdateToLocal, hasLinkFlagUpdate, isEmptyUpdate, replaceObjectContents } from './link-data.js';
import LinkedItemResolver from './link-resolver.js';
import { isPrimaryItem } from './utils.js';

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

export { createChanges };

function getChangedProperty(changes, path) {
	const expanded = foundry.utils.expandObject(foundry.utils.deepClone(changes));
	return foundry.utils.getProperty(expanded, path);
}

/**
 * Updates an item with the given changes.
 * @param {object} item - The item to be updated.
 * @param {object} changes - The changes to be applied to the item.
 */
function updateItem(item, changes) {
	if (item.compendium && !item.isEmbedded) {
		LinkedItemResolver.refreshBaseItem(item, { render: true });
		return;
	}
	if (LinkedItemResolver.isLinked(item)) {
		LinkedItemResolver.hydrateItem(item, { render: true });
	}
	if (!hasLinkFlagUpdate(changes)) return;
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
	const linkedUpdate = options?.linkedUpdate ?? false;
	if (linkedUpdate) return;

	const linkedChange = getChangedProperty(changes, `flags.${MODULE_ID}.isLinked`);
	const baseItemChange = getChangedProperty(changes, `flags.${MODULE_ID}.baseItem`);
	const wasLinked = Boolean(getFlag(item, 'isLinked'));
	const willBeLinked = linkedChange ?? wasLinked;
	const hasBaseItem = Boolean(baseItemChange ?? getFlag(item, 'baseItem'));

	if (item.compendium && !item.isEmbedded) {
		if (willBeLinked && hasLinkFlagUpdate(changes)) {
			foundry.utils.setProperty(changes, `flags.${MODULE_ID}`, {
				baseItem: null,
				isLinked: false,
			});
		}
		return;
	}

	if (wasLinked && willBeLinked === false) {
		LinkedItemResolver.createUnlinkUpdate(item, changes).then((update) => {
			item.update(update, { linkedUpdate: true, diff: false });
		});
		return false;
	}

	if (!willBeLinked || !hasBaseItem) return;

	const filtered = filterUpdateToLocal(changes, item);
	if (isEmptyUpdate(filtered)) return false;
	replaceObjectContents(changes, filtered);
}

function createItem(item) {
	if (!item.compendium) LinkedItemResolver.hydrateItem(item, { render: true });
	updateCompendium(item);
}

function deleteItem(item) {
	if (item.compendium && !item.isEmbedded) LinkedItemResolver.invalidate(item.uuid);
	updateCompendium(item);
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
Hooks.on('createItem', createItem);
Hooks.on('deleteItem', deleteItem);
