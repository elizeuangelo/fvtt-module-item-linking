import { findDerived } from './item.js';
function preUpdate(document, changes) {
    if (!document.parent || !(document.parent instanceof CONFIG.Item.documentClass) || !document.parent.compendium)
        return;
    const item = document.parent;
    const derived = findDerived()[item.uuid];
    derived.map((derivation) => derivation.update(changes));
}
const embedded = Object.keys(CONFIG.Item.documentClass.metadata.embedded);
embedded.forEach((type) => {
    Hooks.on(`preUpdate${type}`, preUpdate);
});
