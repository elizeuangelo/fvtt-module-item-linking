import { MODULE_ID, getSetting } from './settings.js';

export function canOverride(itemData) {
	const overrideOwnerUser = itemData.flags?.[MODULE_ID]?.overrideOwnerUser;
	const isOwner =
		game.user.isGM || itemData?.folder?.data?.permission?.[game.user.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER;
	return game.user.isGM || (isOwner && (!overrideOwnerUser || overrideOwnerUser === game.user.name));
}

function createOverrideButton(sheet, buttons) {
	if (sheet.item.compendium) return;
	if (!getSetting('itemOverrides')) return;
	if (!canOverride(sheet.item)) return;
	buttons.unshift({
		label: 'Item Linking Override',
		class: 'item-link-override',
		icon: 'fas fa-undo',
		onclick: () => {
			new Dialog({
				title: `Item Linking Override`,
				content: /*html*/ `
                    <p>Create additional item linking property exceptions for this item, wich allows more fields to be unlinked.</p>
                    <form autocomplete="off">
                        <div class="form-group">
                            <label>Override Owner</label>
                            <input type="text" name="overrideOwnerUsername" value="${
											sheet.item.getFlag(MODULE_ID, 'overrideOwnerUsername') || ''
										}" placeholder="username">
                            <p class="notes">The Override Owner is the user wich can edit the exception fields. If empty, anyone can edit them. GMs can always edit the exception fields.</p>
                        </div>
                        <div class="form-group">
                            <label>Exception Properties</label>
                            <input type="text" name="exceptionProperties" value="${
											sheet.item.getFlag(MODULE_ID, 'linkPropertyExceptions') || ''
										}" placeholder="name,img,system.description.value">
                            <p class="notes">Additional exception properties, in addition to the system configuration. Use a comma to separate the tags, example: "flags.beavers-crafting,system.description.value"</p>
                            <button type="button" data-action="empty">Empty</button>
                            <button type="button" data-action="default">Default</button>
                        </div>
                    </form>
                    `,
				render: (html) => {
					html.find('button[data-action="empty"]').on('click', () => {
						html.find('input[name="exceptionProperties"]').val('');
					});
					html.find('button[data-action="default"]').on('click', () => {
						html.find('input[name="exceptionProperties"]').val(getSetting('defaultItemOverrides'));
					});
				},
				buttons: {
					save: {
						icon: '<i class="fas fa-check"></i>',
						label: 'Save',
						callback: (html) => {
							const overrideOwnerUsername = html.find('input[name="overrideOwnerUsername"]').val();
							const exceptionProperties = html.find('input[name="exceptionProperties"]').val();
							sheet.item.update({
								flags: { [MODULE_ID]: { overrideOwnerUsername, linkPropertyExceptions: exceptionProperties } },
							});
						},
					},
				},
			}).render(true);
		},
	});
}

/** -------------------------------------------- */
Hooks.on('getItemSheetHeaderButtons', createOverrideButton);
