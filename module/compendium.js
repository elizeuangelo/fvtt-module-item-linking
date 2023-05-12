import { findDerived } from './item.js';
function renderCompendium(pack, html) {
    const freq = findDerived();
    [...html.find('ol.directory-list li')].forEach((li) => {
        const frequency = freq[li.dataset.documentId]?.length;
        if (frequency)
            li.append($(`<b class="link-derivations" data-tooltip="${frequency} derivations linked to this item">(${frequency})</b>`)[0]);
    });
}
Hooks.on('renderCompendium', renderCompendium);
