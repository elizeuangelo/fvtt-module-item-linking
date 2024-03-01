import { setFlag } from './flags.js';
import { findDerived } from './item.js';
import { ProcessingDialog } from './processingDialog.js';

/**
 * Moves an item to another compendium.
 * Helper function for moveToAnotherCompendium.
 * @param {Item} item - The item to be moved.
 * @param {Object} destination - The destination compendium.
 * @param {string} destination.pack - The pack name of the destination compendium.
 * @param {boolean} destination.keepId - Whether to keep the original item ID.
 * @param {string} [destination.folder] - The folder name in the destination compendium.
 * @param {boolean} [destination.relink] - Whether to update derivations of the item in other compendiums.
 * @returns {Promise<void>} - A promise that resolves when the item is successfully moved.
 */
async function moveItem(item, destination, processor) {
	const freq = findDerived();
	const derivations = freq[item.uuid] ?? [];
	const steps = derivations.length + 2;
	let step = 1;
	const updateStep = () => {
		const progress = (100 * step++) / steps;
		processor.label = `Moving item... ${progress.toFixed(0)}%`;
	};
	const data = item.toCompendium(this, {
		keepId: destination.keepId,
		clearFolder: true,
		clearOwnership: true,
	});
	if (destination.folder) data.folder = destination.folder;
	const newItem = await item.constructor.create(data, { pack: destination.pack, keepId: destination.keepId });
	updateStep();
	if (destination.relink && derivations.length) {
		for (const derivation of derivations) {
			setFlag(derivation, 'baseItem', newItem.uuid);
			updateStep();
		}
		ui.notifications.info(`Item ${item.name} derivations updated`);
	}
	item.delete();
	ui.notifications.info(`Item ${item.name} moved to ${destination.pack}`);
}

/**
 * Moves an item in a compendium to another compendium.
 * @param {jQuery} li - The jQuery object representing the list item of the item to be moved.
 * @param {jQuery} html - The jQuery object representing the HTML content of the dialog.
 * @returns {Promise} - A promise that resolves with the result of the move operation.
 */
export async function moveToAnotherCompendium(li, html) {
	function addListeners(html) {
		html.find('select[name="pack"]')[0].addEventListener('change', (event) => _onPackChange(event, html));
	}
	function _onPackChange(event, html) {
		const select = html.find('select[name="folder"]')[0];
		const pack = game.packs.get(event.target.value);
		if (!pack) {
			select.disabled = true;
			return;
		}
		const folders = pack._formatFolderSelectOptions();
		select.disabled = folders.length === 0;
		select.innerHTML = HandlebarsHelpers.selectOptions(folders, {
			hash: {
				blank: '',
				nameAttr: 'id',
				labelAttr: 'name',
			},
		});
	}
	const pack = game.packs.get(html.data().pack);
	const item = await pack.getDocument(li[0].dataset.documentId);
	const packs = game.packs.filter((p) => p.documentName === 'Item' && !p.locked && p !== pack);
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: 'Item' }));
	}
	const content = await renderTemplate('modules/item-linking/templates/item-move.hbs', {
		packs: packs.reduce((obj, p) => {
			obj[p.collection] = p.title;
			return obj;
		}, {}),
		hasFolders: packs[0]?.folders.size > 0,
		folders: packs[0]?.folders.map((f) => ({ id: f.id, name: f.name })) || [],
	});
	const dialog = new Dialog(
		{
			title: `Move Item to Compendium: ${item.name}`,
			content,
			render: (html) => addListeners(html),
			default: 'yes',
			close: () => null,
			buttons: {
				yes: {
					icon: '<i class="fas fa-check"></i>',
					label: game.i18n.localize('FOLDER.ExportTitle'),
					callback: async (html, event, processor) => {
						const form = html[0].querySelector('form');
						try {
							processor.process('Moving item...');
							await moveItem(
								item,
								{
									pack: form.pack.value,
									folder: form.folder.value,
									keepId: form.keepId.checked,
									relink: form.relink.checked,
								},
								processor
							);
						} catch (err) {
							ui.notifications.error(err);
						} finally {
							processor.dialog.close();
						}
					},
				},
			},
		},
		{ classes: ['dialog', 'item-linking-dialog'] }
	);
	new ProcessingDialog(dialog);
	dialog.render(true);
	return dialog;
}

/**
 * Moves a folder and its contents to another compendium.
 * Helper function for moveFolderToAnotherCompendium.
 * @param {Folder} folder - The folder to be moved.
 * @param {Object} destination - The destination compendium and folder.
 * @param {string} destination.pack - The target compendium pack.
 * @param {string} destination.folder - The target folder within the compendium.
 * @param {boolean} destination.relink - Whether to update derivation links in the destination compendium.
 * @returns {Promise<boolean>} - A promise that resolves to true if the folder was successfully moved, false otherwise.
 */
async function moveFolder(folder, destination, processor) {
	async function transformItemDataToItem(folder) {
		folder.contents = await folder.compendium.getDocuments({ folder: folder.id });
		const items = folder.contents;
		for (const child of folder.children) {
			items.push(...(await transformItemDataToItem(child.folder)));
		}
		return items;
	}
	const items = await transformItemDataToItem(folder);
	const freq = findDerived();
	const derivationsMap = new Map(items.map((item) => [item, freq[folder.compendium.getUuid(item.id)] ?? []]));
	const steps = derivationsMap.size + 2;
	let step = 1;
	const updateStep = () => {
		const progress = (100 * step++) / steps;
		processor.label = `Moving folder... ${progress.toFixed(0)}%`;
	};
	const targetPack = game.packs.get(destination.pack);
	const targetFolder = await Folder.create(
		{ name: folder.name, folder: destination.folder, type: 'Item' },
		{ pack: targetPack.collection }
	);
	await folder.exportToCompendium(targetPack, {
		...destination,
		folder: targetFolder.id,
	});
	updateStep();
	try {
		if (destination.relink && derivationsMap.size) {
			for (const [key, derivations] of derivationsMap.entries()) {
				await Promise.all(
					derivations.map((derivation) =>
						setFlag(derivation, 'baseItem', `Compendium.${targetPack.metadata.id}.Item.${key.id}`)
					)
				);
				updateStep();
			}
		}
		ui.notifications.info(`Folder ${folder.name} derivations updated`);
	} catch {
		ui.notifications.error(`Folder ${folder.name} derivations failed to update. Base folder was not deleted.`);
		return false;
	}
	folder.delete({ deleteSubfolders: true, deleteContents: true });
	ui.notifications.info(`Folder ${folder.name} moved to ${destination.pack}`);
	return true;
}

/**
 * Moves a folder inside a compendium to another compendium.
 * @param {string} header - The header of the folder.
 * @param {HTMLElement} html - The HTML element.
 * @returns {Promise} - A promise that resolves when the move operation is complete.
 */
export async function moveFolderToAnotherCompendium(header, html) {
	function addListeners(html) {
		html.find('select[name="pack"]')[0].addEventListener('change', (event) => _onPackChange(event, html));
	}
	function _onPackChange(event, html) {
		const select = html.find('select[name="folder"]')[0];
		const pack = game.packs.get(event.target.value);
		if (!pack) {
			select.disabled = true;
			return;
		}
		const folders = pack._formatFolderSelectOptions();
		select.disabled = folders.length === 0;
		select.innerHTML = HandlebarsHelpers.selectOptions(folders, {
			hash: {
				blank: '',
				nameAttr: 'id',
				labelAttr: 'name',
			},
		});
	}
	const pack = game.packs.get(html.data().pack);
	const folder = await pack.folders.get(header[0].parentElement.dataset.folderId);
	const packs = game.packs.filter((p) => p.documentName === 'Item' && !p.locked && p !== pack);
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
	}
	const content = await renderTemplate('modules/item-linking/templates/folder-move.hbs', {
		packs: packs.reduce((obj, p) => {
			obj[p.collection] = p.title;
			return obj;
		}, {}),
		hasFolders: packs[0]?.folders.size > 0,
		folders: packs[0]?.folders.map((f) => ({ id: f.id, name: f.name })) || [],
	});
	const dialog = new Dialog(
		{
			title: `Move Folder to Compendium: ${folder.name}`,
			content,
			render: (html) => addListeners(html),
			default: 'yes',
			close: () => null,
			buttons: {
				yes: {
					icon: '<i class="fas fa-check"></i>',
					label: game.i18n.localize('FOLDER.ExportTitle'),
					callback: async (html, event, processor) => {
						const form = html[0].querySelector('form');
						try {
							processor.process('Moving folder...');
							await moveFolder(
								folder,
								{
									updateByName: form.merge.checked,
									keepId: true,
									keepFolders: form.keepFolders.checked,
									pack: form.pack.value,
									folder: form.folder.value,
									relink: form.relink.checked,
								},
								processor
							);
						} catch (err) {
							ui.notifications.error(err);
						} finally {
							processor.dialog.close();
						}
					},
				},
			},
		},
		{ classes: ['dialog', 'item-linking-dialog'] }
	);
	new ProcessingDialog(dialog);
	dialog.render(true);
	return dialog;
}

