import { findDerived } from './item.js';
import { findItems } from './findItems.js';
import { moveFolderToAnotherCompendium, moveToAnotherCompendium } from './moveToAnotherCompendium.js';
import { relinkActorsCompendiumApp } from './relink-actors-compendium.js';

/**
 * Renders the compendium by adding link derivations to the list items.
 * @param {Object} pack - The compendium pack.
 * @param {Object} html - The HTML element containing the list items.
 */
function renderCompendium(pack, html) {
	const freq = findDerived();
	[...html.find('ol.directory-list li')].forEach((li) => {
		const uuid = 'Compendium.' + pack.metadata.id + '.Item.' + li.dataset.documentId;
		const frequency = freq[uuid]?.length;
		if (frequency)
			li.append(
				$(
					`<b class="link-derivations" data-tooltip="${frequency} derivations linked to this item">${frequency}</b>`
				)[0]
			);
	});
}

/**
 * Adds additional options to the context menu for an entry.
 * @param {HTMLElement} html - The HTML element representing the entry.
 * @param {Array} entryOptions - The array of existing entry options.
 */
function entryContextMenu(html, entryOptions) {
	if (!game.user?.isGM) return;
	entryOptions.push(
		{
			name: 'Find Items',
			icon: '<i class="fas fa-magnifying-glass"></i>',
			condition: (li) => Boolean(li.find('.link-derivations').length),
			callback: (li) => findItems(li, html),
		},
		{
			name: 'Move Item to Another Compendium',
			icon: '<i class="fas fa-truck"></i>',
			callback: (li) => moveToAnotherCompendium(li, html),
		},
		{
			name: 'Delete All Linked Items',
			icon: '<i class="fas fa-link-slash"></i>',
			callback: (li) => {
				const pack = html.data().pack;
				const freq = findDerived();
				const uuid = 'Compendium.' + pack + '.Item.' + li[0].dataset.documentId;
				const items = freq[uuid];
				if (!items?.length) return ui.notifications.info(`There are no items derived from this item`);
				items.forEach((i) => i.delete());
				ui.notifications.info(`${items.length} items deleted`);
			},
		}
	);
}

/**
 * Adds a context menu option to move a folder to another compendium.
 * @param {HTMLElement} html - The HTML element of the sidebar tab folder.
 * @param {Array} entryOptions - The array of entry options in the context menu.
 */
function sidebarTabFolderContextMenu(html, entryOptions) {
	if (!game.user.isGM) return;
	entryOptions.push({
		name: 'Move Folder to Another Compendium',
		icon: '<i class="fas fa-truck"></i>',
		callback: (header) => moveFolderToAnotherCompendium(header, html),
		condition: (header) => {
			const uuid = header[0].parentElement.dataset.uuid;
			return Boolean(uuid) && uuid.startsWith('Compendium.');
		},
	});
}

/**
 * Creates the "Fix Item Links" Compendium Directory button.
 * @param {Object} app - The application object.
 * @param {Object} html - The HTML object.
 * @param {Object} data - The data object.
 */
function createCompendiumButton(app, html, data) {
	if (!game.user?.isGM) return;
	const header = html.find('.directory-header .header-actions');
	const button = $(`<button class="create-folder"><i class="fas fa-toolbox"></i>Fix Item Links</button>`);
	header.append(button);
	button.on('click', () => relinkActorsCompendiumApp());
}

/** -------------------------------------------- */
Hooks.on('renderCompendium', renderCompendium);
Hooks.on('getCompendiumEntryContext', entryContextMenu);
Hooks.on('getSidebarTabFolderContext', sidebarTabFolderContextMenu);
Hooks.on('renderCompendiumDirectory', createCompendiumButton);

