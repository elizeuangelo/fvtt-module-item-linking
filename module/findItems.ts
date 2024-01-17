import { findDerived } from './item.js';

/**
 * Lists linked items.
 *
 * @param li - The jQuery element representing the master item.
 */
export async function findItems(li: JQuery<HTMLElement>, html: JQuery<HTMLElement>) {
	/**
	 * Deletes an item from the actor.
	 * @param itemUuid - The UUID of the item to delete.
	 * @returns - A promise that resolves to true if the item was successfully deleted, false otherwise.
	 */
	async function deleteItemFromActor(itemUuid: string): Promise<boolean> {
		const itemToDelete = await fromUuid(itemUuid);
		if (!itemToDelete) return false;
		await itemToDelete.delete();
		return true;
	}

	/**
	 * Adds event listeners to the HTML element.
	 * @param html - The HTML element to attach the event listeners to.
	 */
	function addListeners(html: JQuery<HTMLElement>) {
		html.find('.delete-button').on('click', async (ev) => {
			const el = ev.currentTarget;
			const uuid = el.dataset.uuid!;
			const deleted = await deleteItemFromActor(uuid);
			if (deleted) el.closest('tr')!.classList.add('disabled');
		});
	}

	const pack = html.data().pack;
	const freq = findDerived();
	const uuid = 'Compendium.' + pack + '.Item.' + li[0].dataset.documentId!;
	const derivations = freq[uuid];
	if (!derivations?.length) return ui.notifications.info(`There are no items derived from this item`);

	const content = /*html*/ `
        <style>
            table.list-linked {
                text-align: center;
            }
            table.list-linked tr.disabled {
                opacity: 0.5;
                transition: opacity 0.5s ease;
                pointer-events: none;
            }
        </style>
        <div style="max-height:300px;overflow:auto">
            <table class="list-linked">
                <thead>
                <tr style="position: sticky;top: 0;background-color: gray;z-index: 1">
                    <th>Actor</th>
                    <th>Item</th>
                    <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                    ${derivations
						.map(
							(i) => `
                    <tr>
                        <td>${i.actor?.link ?? '<i>World Items Collection</i>'}</td>
                        <td>${i.link}</td>
                        <td>
                            <a class="delete-button" data-tooltip="Delete" data-uuid="${i.uuid}">
                                <i class="fa-solid fa-trash-can"></i>
                            </a>
                        </td>
                    </tr>`
						)
						.join('')}
                </tbody>
            </table>
        </div>
    `;
	const enrichedHTML = await TextEditor.enrichHTML(content, { async: true });

	new Dialog(
		{
			title: 'Linked Items',
			content: enrichedHTML,
			render: (html: JQuery<HTMLElement>) => {
				addListeners(html);
			},
			buttons: {
				done: {
					label: 'Done',
					icon: "<i class='fa-solid fa-check'></i>",
				},
			},
		},
		{ width: 500 }
	).render(true);
}
