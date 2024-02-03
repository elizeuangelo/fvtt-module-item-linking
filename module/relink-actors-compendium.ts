export async function relinkActorsCompendiumApp() {
	/**
	 * Adds event listeners to the HTML element.
	 * @param html - The HTML element to attach the event listeners to.
	 */
	function addListeners(html: JQuery<HTMLElement>) {}

	// Get eligible pack destinations
	const packs = game.packs.filter((p) => p.documentName === 'Item');
	if (!packs.length) {
		return ui.notifications.warn(game.i18n.format('FOLDER.ExportWarningNone', { type: this.type }));
	}

	const folders = game.folders!.filter((f) => f.type === 'Actor');

	// Render the HTML form
	const content = await renderTemplate('modules/item-linking/templates/relink-actors.hbs', {
		packs: packs.map((p) => ({ id: p.metadata.id, name: p.metadata.label })),
		folders,
	});

	// Display it as a dialog prompt
	new Dialog(
		{
			title: `Relink Actors Links to Compendiums`,
			content,
			render: (html: JQuery<HTMLElement>) => addListeners(html),
			default: 'yes',
			close: () => null,
			buttons: {
				yes: {
					icon: '<i class="fas fa-magnifying-glass"></i>',
					label: game.i18n.localize('Search'),
					callback: (html) => {
						const form = html[0].querySelector('form') as HTMLFormElement;
						const data = new FormDataExtended(form);
						if (form.checkValidity() === false) {
							throw new Error(game.i18n.localize('You must select at least one pack and one folder'));
						}
						searchInventory(data.object);
					},
				},
			},
		},
		{ classes: ['dialog', 'item-linking-dialog'], width: 500 }
	).render(true);
}

async function searchInventory(data) {
	const subfolders = data.subfolders;
	const packs = data.packs.map((p) => game.packs.get(p));
	const folders: Folder[] = [];

	for (const id of data.folders) {
		const folder = game.folders!.get(id);
		if (!folder) continue;
		folders.push(folder);
		if (subfolders) {
			folders.push(...folder.getSubfolders(true));
		}
	}

	const entries: any[] = [];
	const actors = game.actors!.filter((a) => folders.includes(a.folder!));
	for (const actor of actors) {
		for (const item of actor.items) {
			const flags = (item as any).flags['item-linking'];
			if (!flags) continue;
			const baseItem = flags.baseItem ? await fromUuid(flags.baseItem) : null;
			const isLinked = flags.isLinked ?? false;
			if (isLinked && baseItem) continue;

			const similarItems = await findSimilarItemsInCompendiums(item.name!, item.type, packs);

			entries.push({ label: CONFIG.Item.typeLabels[item.type], actor, item, similarItems, baseItem, isLinked });
		}
	}

	const content = await renderTemplate('modules/item-linking/templates/relink-inventory.hbs', { entries });

	function addEventListeners(html: JQuery<HTMLElement>) {
		html.find('.btn-update').on('click', async (event) => {
			const button = event.currentTarget;
			const row = button.closest('tr')!;
			const select = row.querySelector('select')! as HTMLSelectElement;
			const selectedUuid = select.value;
			if (selectedUuid) {
				const item = await fromUuid(button.dataset.uuid!);
				await item.update({
					'flags.item-linking.baseItem': selectedUuid,
					'flags.item-linking.isLinked': true,
				});
				// Disable the button and change its color to gray
				button.classList.add('btn-disabled');
				select.disabled = true;

				const dot = row.querySelector('.dot');
				if (dot) dot.classList.add('green');
			}
		});
		html.find('select').on('change', (event) => {
			const select = event.currentTarget!;
			const row = select.closest('tr')!;
			const itemId = row.dataset.item;
			const compendiumItemEl = row.querySelector('.compendium-item');
			const resyncItemEl = row.querySelector('.resync-item');
			compendiumItemEl.dataset.uuid = select.value;
			compendiumItemEl.classList.toggle('btn-disabled', !select.value);
			resyncItemEl.classList.toggle('btn-disabled', !select.value);
		});
		html.find('[data-action="render"]').on('click', async (event) => {
			const button = event.currentTarget;
			const uuid = button.dataset.uuid;
			const item = await fromUuid(uuid);
			item?.sheet?.render(true);
		});
	}

	new Dialog(
		{
			title: 'Inventory Check',
			content,
			buttons: {
				ok: {
					label: 'Close',
				},
			},
			render: (html) => addEventListeners(html),
		},
		{ classes: ['dialog', 'item-linking-dialog'], width: 700 }
	).render(true);
}

async function findSimilarItemsInCompendiums(
	itemName: string,
	itemType: string,
	packs: CompendiumCollection<CompendiumCollection.Metadata>[],
	allItems = false
) {
	const rows: { name: string; uuid: string }[] = [];
	for (const pack of packs) {
		await pack.getIndex(); // Load the compendium index
		const entries = pack.index.filter((i) => i.name === itemName);
		for (const entry of entries) {
			const item = (await pack.getDocument(entry._id)) as Item;
			if (item && item.type === itemType) {
				// Only add items with the matching type
				rows.push({ name: `${item.name} - ${pack.metadata.label}`, uuid: item.uuid });
			}
		}
	}
	return rows;
}
