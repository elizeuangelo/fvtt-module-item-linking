import { derivations } from './item.js';

function countDerivations() {
	const freq: Record<string, number> = {};
	const values = derivations.values();
	for (const v of values) {
		freq[v] = (freq[v] ?? 0) + 1;
	}
	return freq;
}

function renderCompendium(pack: CompendiumCollection<CompendiumCollection.Metadata>, html: JQuery) {
	const baseUuid = 'Compendium.' + pack.metadata.id + '.';

	const freq = countDerivations();

	[...html.find('ol.directory-list li')].forEach((li) => {
		const Uuid = baseUuid + li.dataset.documentId;
		const frequency = freq[Uuid];
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
