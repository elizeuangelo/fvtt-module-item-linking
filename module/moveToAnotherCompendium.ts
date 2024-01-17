import { setFlag } from './flags.js';
import { findDerived } from './item.js';

/**
 * Moves an item to another compendium.
 * @param item - The item to be moved.
 * @param destination - The destination compendium and optional folder.
 * @returns A promise that resolves when the item has been moved.
 */
async function moveItem(
	item: Item,
	destination: {
		pack: string;
		folder?: string;
		relink?: boolean;
		keepId?: boolean;
	}
) {
	const label = `Moving ${item.name}...`;
	SceneNavigation.displayProgressBar({ label, pct: 0 });
	const freq = findDerived();
	const derivations = freq[item.uuid] ?? [];
	const steps = derivations.length + 2;
	let step = 1;
	const updateStep = () => SceneNavigation.displayProgressBar({ label, pct: (100 * step++) / steps });

	const data = item.toCompendium(this, {
		keepId: destination.keepId,
		clearFolder: true,
		clearOwnership: true,
	});
	//@ts-ignore
	if (destination.folder) data.folder = destination.folder;
	//@ts-ignore
	const newItem = await item.constructor.create(data, { pack: destination.pack, keepId: destination.keepId });
	updateStep();

	// Update Derivations Links
	if (destination.relink && derivations.length) {
		for (const derivation of derivations) {
			setFlag(derivation, 'baseItem', newItem.uuid);
			updateStep();
		}
		ui.notifications.info(`Item ${item.name} derivations updated`);
	}

	item.delete();
	SceneNavigation.displayProgressBar({ label, pct: 100 });
	ui.notifications.info(`Item ${item.name} moved to ${destination.pack}`);
}

/**
 * Moves an item to another compendium.
 * @param li - The jQuery element representing the item to be moved.
 * @param html - The jQuery element representing the HTML content.
 * @param options - The options for the move operation.
 * @returns A Promise that resolves to the result of the move operation.
 */
export async function moveToAnotherCompendium(
	li: JQuery<HTMLElement>,
	html: JQuery<HTMLElement>,
	options: {
		pack?: CompendiumCollection<CompendiumCollection.Metadata>;
		keepId?: boolean;
		relink?: boolean;
	} & Partial<DialogOptions> = {}
) {
	/**
	 * Adds event listeners to the HTML element.
	 * @param html - The HTML element to attach the event listeners to.
	 */
	function addListeners(html: JQuery<HTMLElement>) {
		html.find('select[name="pack"]')[0].addEventListener('change', (event) => _onPackChange(event, html));
	}

	function _onPackChange(event: Event, html: JQuery<HTMLElement>) {
		const select = html.find('select[name="folder"]')[0] as HTMLSelectElement;
		const pack = game.packs.get((event.target as HTMLSelectElement).value);
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
		}) as any;
	}

	const pack = game.packs.get(html.data().pack)!;
	const item = (await pack.getDocument(li[0].dataset.documentId!)) as Item;

	// Get eligible pack destinations
	const packs = game.packs.filter((p) => p.documentName === 'Item' && !p.locked && p !== pack);
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
	}

	// Render the HTML form
	const content = await renderTemplate('modules/item-linking/templates/item-move.hbs', {
		packs: packs.reduce((obj, p) => {
			obj[p.collection] = p.title;
			return obj;
		}, {}),
		pack: options.pack ?? null,
		keepId: options.keepId ?? true,
		relink: options.relink ?? true,
		hasFolders: options.pack?.folders?.length ?? false,
		folders: options.pack?.folders?.map((f) => ({ id: f.id, name: f.name })) || [],
	});

	// Display it as a dialog prompt
	return Dialog.prompt({
		title: `Move Item to Compendium: ${item.name}`,
		content,
		render: (html: JQuery<HTMLElement>) => {
			addListeners(html);
		},
		label: game.i18n.localize('FOLDER.ExportTitle'),
		callback: (html) => {
			const form = html[0].querySelector('form');
			return moveItem(item, {
				pack: form.pack.value,
				folder: form.folder.value,
				keepId: form.keepId.checked,
				relink: form.relink.checked,
			});
		},
		rejectClose: false,
		options,
	});
}

async function moveFolder(
	folder: Folder,
	destination: {
		pack: string;
		relink?: boolean;
	} & Folder.ExportToCompendiumOptions
) {
	// Transform Folder and Subfolder to Items
	function transformItemDataToItem(folder: Folder) {
		folder.contents = folder.contents.map((data) => new Item(data as any));
		return [...folder.contents, ...folder.children.flatMap((child) => transformItemDataToItem(child.folder))];
	}

	const items = transformItemDataToItem(folder);

	const label = `Moving ${folder.name}...`;
	SceneNavigation.displayProgressBar({ label, pct: 0 });
	const freq = findDerived();

	const derivationsMap = new Map(items.map((item) => [item, freq[folder.compendium.getUuid(item.id)] ?? []]));

	const steps = derivationsMap.size + 2;
	let step = 1;
	const updateStep = () => SceneNavigation.displayProgressBar({ label, pct: (100 * step++) / steps });

	const targetPack = game.packs.get(destination.pack)!;

	// Create Folder inside Target Pack
	const targetFolder = (await Folder.create(
		{ name: folder.name, folder: destination.folder, type: 'Item' },
		{ pack: targetPack.collection }
	))!;

	await folder.exportToCompendium(targetPack, {
		...destination,
		folder: targetFolder.id,
	});

	updateStep();

	// Update Derivations Links
	try {
		if (destination.relink && derivationsMap.size) {
			for (const [key, derivations] of derivationsMap.entries()) {
				for (const derivation of derivations) {
					setFlag(derivation, 'baseItem', `Compendium.${targetPack.metadata.id}.Item.${key.id}`);
				}
				updateStep();
			}
		}
		ui.notifications.info(`Folder ${folder.name} derivations updated`);
	} catch {
		ui.notifications.error(`Folder ${folder.name} derivations failed to update. Base folder was not deleted.`);
		return false;
	}

	folder.delete({ deleteSubfolders: true, deleteContents: true });
	SceneNavigation.displayProgressBar({ label, pct: 100 });
	ui.notifications.info(`Folder ${folder.name} moved to ${destination.pack}`);
	return true;
}

export async function moveFolderToAnotherCompendium(
	li: JQuery<HTMLElement>,
	html: JQuery<HTMLElement>,
	options: {
		pack?: CompendiumCollection<CompendiumCollection.Metadata>;
		merge?: boolean;
		keepFolders?: boolean;
		keepId?: boolean;
		relink?: boolean;
	} & Partial<DialogOptions> = {}
) {
	/**
	 * Adds event listeners to the HTML element.
	 * @param html - The HTML element to attach the event listeners to.
	 */
	function addListeners(html: JQuery<HTMLElement>) {
		html.find('select[name="pack"]')[0].addEventListener('change', (event) => _onPackChange(event, html));
	}

	function _onPackChange(event: Event, html: JQuery<HTMLElement>) {
		const select = html.find('select[name="folder"]')[0] as HTMLSelectElement;
		const pack = game.packs.get((event.target as HTMLSelectElement).value);
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
		}) as any;
	}

	const pack = game.packs.get(html.data().pack)!;
	const folder = (await pack.folders.get(li[0].parentElement!.dataset.folderId!)) as Folder;

	// Get eligible pack destinations
	const packs = game.packs.filter((p) => p.documentName === 'Item' && !p.locked && p !== pack);
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
	}

	// Render the HTML form
	const content = await renderTemplate('modules/item-linking/templates/folder-move.hbs', {
		packs: packs.reduce((obj, p) => {
			obj[p.collection] = p.title;
			return obj;
		}, {}),
		merge: options.merge ?? true,
		keepFolders: options.keepFolders ?? true,
		pack: options.pack ?? null,
		keepId: options.keepId ?? true,
		relink: options.relink ?? true,
		hasFolders: options.pack?.folders?.length ?? false,
		folders: options.pack?.folders?.map((f) => ({ id: f.id, name: f.name })) || [],
	});

	// Display it as a dialog prompt
	return Dialog.prompt({
		title: `Move Folder to Compendium: ${folder.name}`,
		content,
		render: (html: JQuery<HTMLElement>) => {
			addListeners(html);
		},
		label: game.i18n.localize('FOLDER.ExportTitle'),
		callback: async (html) => {
			const form = html[0].querySelector('form');
			return moveFolder(folder, {
				updateByName: form.merge.checked,
				keepId: true,
				keepFolders: form.keepFolders.checked,
				pack: form.pack.value,
				folder: form.folder.value,
				relink: form.relink.checked,
			});
		},
		rejectClose: false,
		options,
	});
}
