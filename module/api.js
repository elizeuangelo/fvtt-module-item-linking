import { isPrimaryItem, parseAsArray } from './utils.js';
import Logger from './lib/Logger.js';
import { RetrieveHelpers } from './lib/retrieve-helpers.js';

const API = {
  /**
   * Method for check if the item is a primary item
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {boolean} if is a primary item or not
   */
	isPrimaryItem(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		return isPrimaryItem(itemToCheckTmp);
	},

  /**
   * Method for check if the item is not linked (ignored base item, no link)
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {boolean} if is not linked or not
   */
	isItemNotLinked(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		const isLinked = getProperty(itemToCheckTmp, `flags.item-linking.isLinked`);
		if (!isLinked) {
			return true;
		}
		return false;
	},

  /**
   * Method for check if the item is linked (yes base item, yes link)
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {boolean} if is linked or not
   */
	isItemLinked(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		const hasBaseItem = getProperty(itemToCheckTmp, `flags.item-linking.baseItem`);
		const isLinked = getProperty(itemToCheckTmp, `flags.item-linking.isLinked`);
		if (hasBaseItem && isLinked) {
			return true;
		}
		return false;
	},

  /**
   * Method for check if the item is with a broken link (no base item, yes link)
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {boolean} if is with a broken link or not
   */
	isItemBrokenLink(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		const hasBaseItem = getProperty(itemToCheckTmp, `flags.item-linking.baseItem`);
		const isLinked = getProperty(itemToCheckTmp, `flags.item-linking.isLinked`);
		if (!hasBaseItem && isLinked) {
			return true;
		}
		return false;
	},

  /**
   * Method for check if the item is unlinked (no base item, no link)
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {boolean} if is unlinked
   */
	isItemUnlinked(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		const hasBaseItem = getProperty(itemToCheckTmp, `flags.item-linking.baseItem`);
		const isLinked = getProperty(itemToCheckTmp, `flags.item-linking.isLinked`);
		if (!hasBaseItem && !isLinked) {
			return true;
		}
		return false;
	},

  /**
   * Method for retrieve the linked item if present
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @returns {Item|null} the item linked
   */
	retrieveLinkedItem(itemToCheck) {
		const itemToCheckTmp = RetrieveHelpers.getItemSync(itemToCheck);
		if (!this.isItemLinked(itemToCheckTmp)) {
			Logger.warn(`retrieveLinkedItem | The item ${itemToCheckTmp.name}|${itemToCheckTmp.uuid} is not linked`, true);
			return;
		}
		const baseItemUuid = getProperty(itemToCheckTmp, `flags.item-linking.baseItem`, true);
		if (!baseItemUuid) {
			Logger.warn(`retrieveLinkedItem | No baseItemUuid is been found for ${itemToCheckTmp.name}|${itemToCheckTmp.uuid}`);
			return;
		}
		const baseItem = RetrieveHelpers.getItemSync(baseItemUuid);
		if (!baseItem) {
			Logger.warn(`retrieveLinkedItem | No baseItem is been found for ${itemToCheckTmp.name}|${itemToCheckTmp.uuid}`, true);
			return;
		}
		return baseItem;
	},

  /**
   * Method for set a linked item to another item
   * @param {string|Item} itemToCheck the item or the item reference like id, uuid, ecc. to check
   * @param {string|item} itemBaseReference
   * @returns {Promise<Void>}
   */
	async setLinkedItem(itemToCheck, itemBaseReference) {
		if (!itemBaseReference) {
			Logger.warn(`setLinkedItem | The 'baseItemReference' is null or empty`, true);
			return;
		}
		const itemToCheckTmp = await RetrieveHelpers.getItemAsync(itemToCheck);
		if (this.isItemLinked(itemToCheckTmp)) {
			Logger.warn(`setLinkedItem | The 'itemToCheck' is not linked`, true);
			return itemToCheckTmp;
		}
		const baseItem = await RetrieveHelpers.getItemAsync(itemBaseReference);
		if (baseItem) {
			Logger.warn(`setLinkedItem | No 'baseItem' is been found for ${itemBaseReference}`);
			return;
		}
		const baseItemUuid =
			this.retrieveLinkedItem(baseItem)?.uuid ?? getProperty(baseItem, `flags.core.sourceId`) ?? baseItem.uuid;
		if (!baseItemUuid) {
			Logger.warn(`setLinkedItem | The 'uuidToSet' is null or empty`, true);
			return;
		}
		const itemBaseTmp = await RetrieveHelpers.getItemAsync(baseItemUuid);
		if(!itemBaseTmp) {
			Logger.warn(`setLinkedItem | The 'baseItem' is null or empty`, true);
			return;
		}

		await itemToCheckTmp.setFlag('item-linking', 'baseItem', baseItemUuid);
		await itemToCheckTmp.setFlag('item-linking', 'isLinked', true);
		return itemToCheckTmp;
	},

  /**
   * Method to update a item on a actor with the linked item
   * @param {string|Item} itemToCheck the item to check
   * @param {boolean=false} force should the original item deleted from the actor ?
   * @returns {Promise<Void>}
   */
	async replaceItemWithLinkedItemOnActor(itemToCheck, force = false) {
		let itemToCheckTmp = await RetrieveHelpers.getItemAsync(itemToCheck);
		if (this.isItemLinked(itemToCheckTmp)) {
			const toReplace = await RetrieveHelpers.getItemAsync(itemToCheckTmp.uuid);
			const itemLinked = this.retrieveLinkedItem(itemToCheckTmp);
			const obj = item.toObject();
			obj.flags['item-linking'] = {
				isLinked: true,
				baseItem: itemLinked,
			};
			const owner = toReplace.actor;
			if (!owner) {
				throw Logger.error(`The item '${itemToCheckTmp}' is not on a actor`);
			}
			if (force) {
				await toReplace.delete();
			} else {
				const conf = await toReplace.deleteDialog();
				if (!conf) {
					return false;
				}
			}
			return await owner.createEmbeddedDocuments('Item', [obj]);
		} else {
			Logger.warn(`The item '${itemToCheckTmp?.name}' is already linked`);
		}
	},

  /**
   * A "Save Time" method for attempting to link through certain filters
   * character objects to objects in a compendium list, useful when transferring
   * an actor from one world to another
   *
   * @param {Actor|string} actor The reference to the actor entity, can be a Actor or a Actor id, uuid, name
   * @param {string|string[]} compendiumsFolderToCheck A list of folder names in the compendium directory from which to retrieve collections
   * @param {Object} options
   * @param {boolean} [options.onlyItems=true] Whether to automatically display the results in chat
   * @param {string[]} [options.typesToFilter=[]] A list of types to filter e.g. ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'backpack', 'feat']
   * @param {string} [options.compendiumForNoMatch=null]  Unmatched documents can be included in this compendium if present
   */
	async tryToUpdateActorWithLinkedDocumentsFromCompendiumFolder(actor, compendiumsFolderToCheck, options) {
		if (!compendiumsFolderToCheck) {
			Logger.warn(
				`tryToUpdateActorWithLinkedDocumentsFromCompendiumFolder | No compendiums folder is been passed`,
				true
			);
			return;
		}
		const compendiumsFolder = parseAsArray(compendiumsFolderToCheck);
		const onlyItems = options.onlyItems ? true : false;
		let compendiumsFiltered = [];
		if (onlyItems) {
			compendiumsFiltered = game.packs.contents.filter(
				(pack) => pack.metadata.type === 'Item' && compendiumsFolder.includes(pack.folder?.name)
			);
		} else {
			compendiumsFiltered = game.packs.contents.filter((pack) => compendiumsFolder.includes(pack.folder?.name));
		}
		await this.tryToUpdateActorWithLinkedDocumentsFromCompendiums(actor, compendiumsFiltered, options);
	},

  /**
   * A "Save Time" method for attempting to link through certain filters
   * character objects to objects in a compendium list, useful when transferring
   * an actor from one world to another
   *
   * @param {Actor|string} actor The reference to the actor entity, can be a Actor or a actor id, uuid, name
   * @param {string|string[]} compendiumsToCheck A list of compendium collection references to the compendium collection entities, can be a CompendiumCollection or a CompendiumCollection id, uuid, name
   * @param {Object} options
   * @param {boolean} [options.onlyItems=true] Whether to automatically display the results in chat
   * @param {string[]} [options.typesToFilter=[]] A list of types to filter e.g. ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'backpack', 'feat']
   * @param {string} [options.compendiumForNoMatch=null] Unmatched documents can be included in this compendium if present
   */
	async tryToUpdateActorWithLinkedDocumentsFromCompendiums(actor, compendiumsToCheck, options) {
		const actorToUpdate = await RetrieveHelpers.getActorAsync(actor, false);
		if (!actorToUpdate) {
			Logger.warn(`tryToUpdateActorWithLinkedDocumentsFromCompendiums | No Actor is been passed`, true);
			return;
		}
		const compendiumsReferences = parseAsArray(compendiumsToCheck);
		const onlyItems = options.onlyItems ? true : false;
		const typesToFilter = parseAsArray(options.typesToFilter) ?? [];
		const compendiumForNoMatch = options.compendiumForNoMatch ? options.compendiumForNoMatch : 'No Linked Documents';
		const compendiums = [];
		for (const ref of compendiumsReferences) {
			const comp = await RetrieveHelpers.getCompendiumCollectionAsync(ref, false);
			if (comp) {
				compendiums.push(comp);
			}
		}
		if (!compendiums || compendiums.length === 0) {
			Logger.warn(`tryToLinkItemsFromCompendium | No Compendiums is been passed with value`, true);
			return;
		}
		const documentsToCheckMap = {};
		for (const pack of compendiums) {
			const documentsRetrieved = await pack.getDocuments();
			if (onlyItems) {
				if (pack.metadata.type === 'Item') {
					documentsRetrieved.forEach((doc) => {
						documentsToCheckMap[doc.name] ??= [];
						documentsToCheckMap[doc.name].push(doc);
					});
				} else {
				}
			} else {
				documentsRetrieved.forEach((doc) => {
					documentsToCheckMap[doc.name] ??= [];
					documentsToCheckMap[doc.name].push(doc);
				});
			}
		}
		if (Object.keys(documentsToCheckMap).length === 0) {
			Logger.info(`No documents were found in the compendiums`, true);
			return;
		}
		const itemsOnActor = actorToUpdate.items.contents ?? [];
		let documentsFound = 0,
			documentsUpdated = 0,
			documentsAlreadyLinked = 0,
			documentsBroken = 0,
			documentsWithNoMatch = [];
		for (const itemTryToLink of itemsOnActor) {
			documentsFound++;
			if (!typesToFilter.includes(itemTryToLink.type)) {
				continue;
			}
			const alreadyLinked = getProperty(itemTryToLink, `flags.item-linking.isLinked`);
			if (alreadyLinked) {
				documentsAlreadyLinked++;
				const broken_link = !Boolean(await fromUuid(getProperty(itemTryToLink, `flags.item-linking.baseItem`)));
				if (broken_link) {
					documentsBroken++;
				} else continue;
			}
			if (!(itemTryToLink.name in documentsToCheckMap)) {
				documentsWithNoMatch.push(itemTryToLink);
				continue;
			}
			let match = false;
			for (const similar of documentsToCheckMap[itemTryToLink.name]) {
				const isTrulySimilar = similar.type === itemTryToLink.type;
				if (!isTrulySimilar) continue;
				await itemTryToLink.update({
					'flags.item-linking': {
						isLinked: true,
						baseItem: similar.uuid,
					},
				});
				match = true;
				documentsUpdated++;
				break;
			}
			if (!match) {
				documentsWithNoMatch.push(itemTryToLink);
			}
		}
		ui.notifications.info(
			`Total of <b>${documentsFound}</b> items found, <b>${documentsUpdated}</b> were fixed and linked, <b>${documentsAlreadyLinked}</b> were already linked, ${documentsBroken} had broken links and <b>${documentsWithNoMatch.length}</b> were not linked but there was no compatible document in the compendiums.`,
			{ permanent: true }
		);
		const names = new Set();
		const unique_no_match = documentsWithNoMatch.filter((i) => {
			const name = `${i.name} (${i.type})`;
			if (names.has(name)) return false;
			names.add(name);
			return true;
		});
		const confirm = await Dialog.confirm({
			title: 'Create Linked Documents',
			content: `<p>Do you want to include these unique <b>${
				unique_no_match.length
			}</b> unmatched documents in the ${compendiumForNoMatch} compendium?</p>
            <ul style="display: flex;flex-direction: column;flex-wrap: wrap;gap: 10px;height: max-content;max-height: 200px;overflow-x: scroll;align-content: space-around;">
            <li>${[...names].join('</li><li>')}</li></ul>`,
		});
		if (confirm) {
			const noMatchCompendium = game.packs.contents.find((pack) => pack.metadata.label === compendiumForNoMatch);
			if (!noMatchCompendium) {
				Logger.error(`Compendium ${compendiumForNoMatch} not found`, true);
				return;
			}
			let items_fixed = 0;
			for (const itemWithNoMatch of unique_no_match) {
				const compendium_item = await noMatchCompendium.importDocument(itemWithNoMatch);
				for (const item of documentsWithNoMatch) {
					if (compendium_item.name !== item.name || compendium_item.type !== item.type) {
						continue;
					}
					await item.update({
						'flags.item-linking': {
							isLinked: true,
							baseItem: compendium_item.uuid,
						},
					});
					items_fixed++;
				}
			}
			ui.notifications.info(
				`<b>${unique_no_match.length}</b> items created and <b>${items_fixed}</b> items linked`,
				{
					permanent: true,
				}
			);
		}
	},
};
export default API;
