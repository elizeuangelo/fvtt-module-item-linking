import { findDerived } from './item.js';

function renderCompendium(pack: CompendiumCollection<CompendiumCollection.Metadata>, html: JQuery) {
	const freq = findDerived();

	[...html.find('ol.directory-list li')].forEach((li) => {
		const uuid = 'Compendium.' + pack.metadata.id + '.' + li.dataset.documentId!;
		const frequency = freq[uuid]?.length;
		if (frequency)
			li.append(
				$(
					/*html */ `<b class="link-derivations" data-tooltip="${frequency} derivations linked to this item">${frequency}</b>`
				)[0]
			);
	});
}

interface entryOption {
	name: string;
	icon: string;
	condition?: (li: JQuery<HTMLLIElement>) => boolean;
	callback: (li: JQuery<HTMLLIElement>) => any;
}

export default function contextMenu(html: JQuery, entryOptions: entryOption[]) {
	entryOptions.push({
		name: 'Delete All Linked Items',
		icon: '<i class="fas fa-link-slash"></i>',
		callback: (li) => {
			const pack = html.data().pack;
			const freq = findDerived();
			const uuid = 'Compendium.' + pack + '.' + li[0].dataset.documentId!;
			const items = freq[uuid];
			if (!items?.length) return ui.notifications.info(`There are no items derived from this item`);
			items.forEach((i) => i.delete());
			ui.notifications.info(`${items.length} items deleted`);
		},
	});
}

/** -------------------------------------------- */
Hooks.on('renderCompendium', renderCompendium);
Hooks.on('getCompendiumEntryContext', contextMenu);
