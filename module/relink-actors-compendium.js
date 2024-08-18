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
	const folders = game.folders.filter((f) => f.type === 'Actor');
	const types = game.documentTypes.Item.filter((t) => t !== CONST.BASE_DOCUMENT_TYPE);
	const content = await renderTemplate('modules/item-linking/templates/relink-actors.hbs', {
		packs: packs.map((p) => ({ id: p.metadata.id, name: p.metadata.label })),
		folders,
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
					callback: async (html, event, processor) => {
						const form = html[0].querySelector('form');
						const data = new FormDataExtended(form);
						if (form.reportValidity() === false) {
							throw new Error(game.i18n.localize('You must select at least one pack and one folder'));
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
 * @param {boolean} data.subfolders - Flag indicating whether to include subfolders in the search.
 * @param {boolean} data.hideUnmatched - Flag indicating whether to hide unmatched items.
 * @param {string} data.typeFilter - The type of the item to search for.
 * @param {string[]} data.packs - An array of pack names to search for items.
 * @param {string[]} data.folders - An array of folder IDs to search for items.
 * @returns {Promise<void>} - A promise that resolves when the inventory search is complete.
 */
async function searchInventory(data, processor) {
	const subfolders = data.subfolders;
	const packs = data.packs.map((p) => game.packs.get(p));
	const folders = [];
	const packsItems = (await Promise.all(packs.map((p) => p.getDocuments()))).flat();
	processor.label = `Searching... found ${packsItems.length} items in ${packs.length} packs`;
	for (const id of data.folders) {
		const folder = game.folders.get(id);
		if (!folder) continue;
		folders.push(folder);
		if (subfolders) {
			folders.push(...folder.getSubfolders(true));
		}
	}
	const entries = [];
	const actors = game.actors.filter((a) => folders.includes(a.folder));
	processor.label = `Searching... found ${actors.length} actors in ${folders.length} folders`;
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
			close: () => null,
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
									item.update({
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
		{ classes: ['dialog', 'item-linking-dialog'], width: 800, resizable: true }
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

