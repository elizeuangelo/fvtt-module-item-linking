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

	let tableRows = '';
	const actors = game.actors!.filter((a) => folders.includes(a.folder!));
	for (const actor of actors) {
		for (const item of actor.items) {
			const flags = (item as any).flags['item-linking'];
			if (!flags) continue;
			const baseItem = flags.baseItem ? await fromUuid(flags.baseItem) : null;
			if (flags.isLinked && baseItem) continue;

			const similarItems = await findSimilarItemsInCompendiums(item.name!, item.type, packs);
			const selectHTML = createSelectHTML(similarItems, item.id);
			const greenDotHTML = showGreenDot(similarItems);

			tableRows += `
                        <tr>
                            <td class="actor">${actor.name}</td>
                            <td class="name">${item.name}</td>
                            <td>
                                <i class="fas fa-sync-alt btn-update" data-actor-id="${actor.id}" data-item-id="${item.id}" title="Update"></i>
                            </td>
                            <td>${greenDotHTML}</td>
                            <td class="similar-items">${selectHTML}</td>
                            <td class="type">${item.type}</td>
                            <td class="base-item">N/A</td>
                            <td class="linked">${flags.isLinked}</td>
                        </tr>
                    `;
		}
	}

	const content = `<table class="itable">
                        <thead>
                        </thead>
                        <tbody>${tableRows}</tbody></table>`;

	new Dialog(
		{
			title: 'Inventory Check',
			content,
			buttons: {
				ok: {
					label: 'Close',
				},
			},
			render: (html) => {
				html.find('.btn-update').click(async (event) => {
					const button = event.currentTarget;
					const actorId = button.dataset.actorId;
					const itemId = button.dataset.itemId;
					const select = document.querySelector('#similar-select-' + itemId);
					const selectedUuid = select.value;
					if (selectedUuid) {
						const actor = game.actors!.get(actorId)!;
						const item = actor.items.get(itemId)!;
						await item.update({
							'flags.item-linking.baseItem': selectedUuid,
							'flags.item-linking.isLinked': true,
						});
						// Disable the button and change its color to gray
						button.classList.add('btn-disabled');

						// Open the item sheet of the compendium item
						const compendiumItem = await fromUuid(selectedUuid);
						compendiumItem.sheet.render(true);
					}
				});
			},
		},
		{ classes: ['dialog', 'item-linking-dialog'], width: 600 }
	).render(true);
}

async function findSimilarItemsInCompendiums(
	itemName: string,
	itemType: string,
	packs: CompendiumCollection<CompendiumCollection.Metadata>[]
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

// Function to create select HTML with options
function createSelectHTML(options, itemId) {
	let selectHTML = `<select id="similar-select-${itemId}" name="similarItem">`;
	selectHTML += `<option value="">Select similar item</option>`;
	for (let option of options) {
		selectHTML += `<option value="${option.uuid}">${option.name}</option>`;
	}
	selectHTML += `</select>`;
	return selectHTML;
}

// Function to check if we should show a green dot
function showGreenDot(options) {
	return options.length > 0 ? `<span class="dot green"></span>` : '<span class="dot red"></span>';
}
