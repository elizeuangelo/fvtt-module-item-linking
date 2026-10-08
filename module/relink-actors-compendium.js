import { isArchivePack, rebuildArchiveLinks, syncActors } from './archive-links.js';
import { ProcessingDialog } from './processingDialog.js';

/**
 * Relinks Actor to Compendiums Application.
 * @returns {Promise<void>} A promise that resolves when the relinking process is complete.
 */
export async function relinkActorsCompendiumApp() {
	const packs = game.packs.filter((p) => p.documentName === 'Item');
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
	}
	const actorPacks = game.packs.filter(isArchivePack);
	if (!actorPacks.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: 'Actor' }));
	}
	const types = game.documentTypes.Item.filter((t) => t !== CONST.BASE_DOCUMENT_TYPE);
	const content = await renderTemplate('modules/item-linking/templates/relink-actors.hbs', {
		packs: packs.map((p) => ({ id: p.metadata.id, name: p.metadata.label })),
		actorPacks: actorPacks.map((p) => ({ id: p.metadata.id, name: p.metadata.label })),
		types: Object.fromEntries(
			types.map((t) => [t, game.i18n.localize(CONFIG.Item.typeLabels[t])]).sort((a, b) => a[1].localeCompare(b[1]))
		),
	});
	const dialog = new Dialog(
		{
			title: `Relink Actors Links to Compendiums`,
			content,
			default: 'yes',
			close: () => null,
			buttons: {
				yes: {
					icon: '<i class="fas fa-magnifying-glass"></i>',
					label: game.i18n.localize('Search'),
					callback: async (html, _event, processor) => {
						const form = html[0].querySelector('form');
						const data = new FormDataExtended(form);
						if (form.reportValidity() === false) {
							throw new Error(game.i18n.localize('You must select at least one item pack and one actor pack'));
						}
						try {
							processor.process('Searching...');
							await searchInventory(data.object, processor);
						} catch (err) {
							ui.notifications.error(err);
						} finally {
							processor.dialog.close();
						}
					},
				},
				archives: {
					icon: '<i class="fas fa-box-archive"></i>',
					label: 'Recount Archived Links',
					callback: async () => {
						try {
							ui.notifications.info('Loading unlocked world Actor compendiums...');
							const updated = await rebuildArchiveLinks();
							ui.notifications.info(`Archived links recounted, ${updated} actors updated`);
						} catch (err) {
							ui.notifications.error(err);
						}
					},
				},
			},
		},
		{ classes: ['dialog', 'item-linking-dialog'], width: 500 }
	);
	new ProcessingDialog(dialog);
	dialog.render(true);
}

/**
 * Searches the inventory for linked items and renders a dialog with the results.
 * @param {Object} data - The data object containing information about the inventory search.
 * @param {boolean} data.hideUnmatched - Flag indicating whether to hide unmatched items.
 * @param {boolean} data.hideNpcs - Flag indicating whether to hide NPCs.
 * @param {string} data.typeFilter - The type of the item to search for.
 * @param {string[]} data.packs - An array of pack names to search for items.
 * @param {string[]} data.actorPacks - An array of world Actor pack names whose actors are searched.
 * @returns {Promise<void>} - A promise that resolves when the inventory search is complete.
 */
async function searchInventory(data, processor) {
	const packs = data.packs.map((p) => game.packs.get(p));
	const actorPacks = data.actorPacks.map((p) => game.packs.get(p));
	const packsItems = (await Promise.all(packs.map((p) => p.getDocuments()))).flat();
	processor.label = `Searching... found ${packsItems.length} items in ${packs.length} packs`;
	// Selected packs stay unlocked while the results are open, so their items can be relinked.
	const loaded = new Map();
	const locked = [];
	let restored = false;
	async function restorePacks() {
		if (restored) return;
		restored = true;
		for (const [pack, actors] of loaded) await syncActors(pack, actors);
		for (const pack of locked) await pack.configure({ locked: true });
	}
	const entries = [];
	try {
		for (const pack of actorPacks) {
			if (!pack.locked) continue;
			await pack.configure({ locked: false });
			locked.push(pack);
		}
		for (const pack of actorPacks) {
			const ids = pack.index.filter((a) => !data.hideNpcs || a.type !== 'npc').map((a) => a._id);
			loaded.set(pack, await pack.getDocuments({ _id__in: ids }));
		}
		const actors = [...loaded.values()].flat();
		processor.label = `Searching... found ${actors.length} actors in ${actorPacks.length} packs`;
		for (const actor of actors) {
			for (const item of actor.items) {
				if (data.typeFilter && item.type !== data.typeFilter) continue;
				const flags = item.flags['item-linking'];
				if (!flags) continue;
				const baseItem = flags.baseItem ? await fromUuid(flags.baseItem) : null;
				const isLinked = flags.isLinked ?? false;
				if (isLinked && baseItem) continue;
				const similarItems = findSimilarItemsInCompendiums(item.name, item.type, packsItems);
				if (similarItems.length === 0 && data.hideUnmatched) continue;
				entries.push({ label: CONFIG.Item.typeLabels[item.type], actor, item, similarItems, baseItem, isLinked });
			}
		}
	} catch (err) {
		await restorePacks();
		throw err;
	}
	const content = await renderTemplate('modules/item-linking/templates/relink-inventory.hbs', {
		entries,
	});
	function addEventListeners(html) {
		html.find('.btn-update').on('click', async (event) => {
			const button = event.currentTarget;
			const row = button.closest('tr');
			const select = row.querySelector('select');
			const selectedUuid = select.value;
			if (selectedUuid) {
				const item = await fromUuid(button.dataset.uuid);
				await item.update({
					'flags.item-linking.baseItem': selectedUuid,
					'flags.item-linking.isLinked': true,
				});
				button.classList.add('btn-disabled');
				select.disabled = true;
				const dot = row.querySelector('.dot');
				if (dot) dot.classList.add('green');
			}
		});
		html.find('select').on('change', (event) => {
			const select = event.currentTarget;
			const row = select.closest('tr');
			const compendiumItemEl = row.querySelector('.compendium-item');
			//const resyncItemEl = row.querySelector('.resync-item');
			compendiumItemEl.dataset.uuid = select.value;
			//compendiumItemEl.classList.toggle('btn-disabled', !select.value);
			//resyncItemEl.classList.toggle('btn-disabled', !select.value);
		});
		html.find('[data-action="render"]').on('click', async (event) => {
			const button = event.currentTarget;
			const uuid = button.dataset.uuid;
			const item = await fromUuid(uuid);
			item?.sheet?.render(true);
		});
	}
	const dialog = new Dialog(
		{
			title: 'Inventory Check',
			content,
			close: () => restorePacks(),
			default: 'ok',
			buttons: {
				ok: {
					label: 'Close',
				},
				linkall: {
					label: 'Link All Single Matches',
					icon: '<i class="fas fa-link"></i>',
					callback: async (html, _event, processor) => {
						const buttons = html.find('.btn-update');
						const links = [];
						for (const button of buttons) {
							const row = button.closest('tr');
							const matches = row.querySelectorAll('select option').length;
							if (matches === 1) {
								links.push(button);
							}
						}
						if (links.length === 0) {
							ui.notifications.info('No single matches found to link.');
							return;
						}
						processor.process(`Updating ${links.length} links...`);
						try {
							for (const button of links) {
								const row = button.closest('tr');
								const select = row.querySelector('select');
								const selectedUuid = select.value;
								if (selectedUuid) {
									const item = await fromUuid(button.dataset.uuid);
									await item.update({
										'flags.item-linking.baseItem': selectedUuid,
										'flags.item-linking.isLinked': true,
									});
									button.classList.add('btn-disabled');
									select.disabled = true;
									const dot = row.querySelector('.dot');
									if (dot) dot.classList.add('green');
								}
							}
						} finally {
							processor.restart();
						}
					},
				},
			},
			render: (html) => addEventListeners(html),
		},
		{ classes: ['dialog', 'item-linking-dialog'], width: 840, resizable: true }
	);
	new ProcessingDialog(dialog, 'linkall');
	dialog.render(true);
	return dialog;
}

/**
 * Finds similar items in compendiums based on the provided item name, item type, and array of packs items.
 * @param {string} itemName - The name of the item to search for.
 * @param {string} itemType - The type of the item to search for.
 * @param {Array} packsItems - An array of items from the packs.
 * @returns {Array} - An array of objects containing the name and UUID of the found items.
 */
function findSimilarItemsInCompendiums(itemName, itemType, packsItems) {
	const rows = [];
	const filteredItems = packsItems.filter((i) => i.name === itemName && i.type === itemType);
	for (const item of filteredItems) {
		if (item && item.type === itemType) {
			rows.push({ name: `${item.name} - ${item.compendium.metadata.label}`, uuid: item.uuid });
		}
	}
	return rows;
}

