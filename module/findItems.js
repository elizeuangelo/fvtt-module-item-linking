import { findArchivedItems } from './archive-links.js';
import { findDerived } from './item.js';

/**
 * Finds and displays linked items in a dialog box.
 * @param {jQuery} li - The list item element.
 * @param {jQuery} html - The HTML element.
 * @returns {Promise<void>} - A promise that resolves when the dialog is rendered.
 */
export async function findItems(li, html) {
	async function deleteItemFromActor(itemUuid) {
		const itemToDelete = await fromUuid(itemUuid);
		if (!itemToDelete) return false;
		await itemToDelete.delete();
		return true;
	}
	function addListeners(html) {
		html.find('.delete-button:not(.disabled)').on('click', async (ev) => {
			const el = ev.currentTarget;
			const uuid = el.dataset.uuid;
			const deleted = await deleteItemFromActor(uuid);
			if (deleted) el.closest('tr').classList.add('disabled');
		});
	}
	const pack = html.metadata.id;
	const freq = findDerived();
	const uuid = 'Compendium.' + pack + '.Item.' + li[0].dataset.documentId;
	const derivations = [...(freq[uuid] ?? []), ...(await findArchivedItems(uuid))];
	if (!derivations.length) return ui.notifications.info(`There are no items derived from this item`);
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
            table.list-linked .delete-button.disabled {
                opacity: 0.2;
                cursor: default;
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
                        <td>${i.actor?.link ?? '<i>World Items Collection</i>'}${
										i.compendium
											? ` <i class="fas fa-box-archive" data-tooltip="${Handlebars.escapeExpression(i.compendium.title)}"></i>`
											: ''
									}</td>
                        <td>${i.link}</td>
                        <td>
                            <a class="delete-button${i.compendium?.locked ? ' disabled' : ''}" data-tooltip="${
										i.compendium?.locked ? 'Compendium is locked' : 'Delete'
									}" data-uuid="${i.uuid}">
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
			render: (html) => {
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

