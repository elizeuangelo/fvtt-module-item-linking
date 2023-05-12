import { findDerived } from './item.js';

function renderCompendium(pack: CompendiumCollection<CompendiumCollection.Metadata>, html: JQuery) {
	const freq = findDerived();

	[...html.find('ol.directory-list li')].forEach((li) => {
		const uuid = 'Compendium.' + pack.metadata.id + '.' + li.dataset.documentId!;
		const frequency = freq[uuid]?.length;
		if (frequency)
			li.append(
				$(
					/*html */ `<b class="link-derivations" data-tooltip="${frequency} derivations linked to this item">(${frequency})</b>`
				)[0]
			);
	});
}

/** -------------------------------------------- */
Hooks.on('renderCompendium', renderCompendium);
