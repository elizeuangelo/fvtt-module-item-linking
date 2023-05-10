import { derivations } from './item.js';
function countDerivations() {
    const freq = {};
    const values = derivations.values();
    for (const v of values) {
        freq[v.id] = (freq[v.id] ?? 0) + 1;
    }
    return freq;
}
function renderCompendium(pack, html) {
    const freq = countDerivations();
    [...html.find('ol.directory-list li')].forEach((li) => {
        const frequency = freq[li.dataset.documentId];
        if (frequency)
            li.append($(`<b class="link-derivations" data-tooltip="${frequency} derivations linked to this item">(${frequency})</b>`)[0]);
    });
}
Hooks.on('renderCompendium', renderCompendium);
