import { deleteItem } from './item.js';
function deleteEmbeddedDocuments(actor) {
    Object.values(actor.collections).forEach((col) => {
        col.forEach((i) => deleteItem(i));
    });
}
Hooks.on('deleteActor', deleteEmbeddedDocuments);
