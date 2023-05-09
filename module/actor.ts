import { deleteItem } from './item.js';

function deleteEmbeddedDocuments(actor: Actor) {
	Object.values(actor.collections).forEach((col) => {
		col.forEach((i: any) => deleteItem(i));
	});
}

/** -------------------------------------------- */
Hooks.on('deleteActor', deleteEmbeddedDocuments);
