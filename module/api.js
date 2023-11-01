import { MODULE } from "./settings.js";
import { getActorAsync, getCompendiumCollectionAsync, parseAsArray, warn } from "./utils.js";

const API = {

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

    if(!compendiumsFolderToCheck) {
      ui.notifications.warn(`${MODULE} | tryToUpdateActorWithLinkedDocumentsFromCompendiumFolder | No compendiums folder is been passed`);
      return;
    }

    const compendiumsFolder = parseAsArray(compendiumsFolderToCheck);
    const onlyItems = options.onlyItems ? true : false;

    let compendiumsFiltered = [];
    if(onlyItems) {
      compendiumsFiltered = game.packs.contents.filter(
        (pack) => pack.metadata.type === 'Item' && compendiumsFolder.includes(pack.folder?.name)
      );
    } else {
      compendiumsFiltered = game.packs.contents.filter(
        (pack) => compendiumsFolder.includes(pack.folder?.name)
      );
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
    const actorToUpdate = await getActorAsync(actor, false);
    if(!actorToUpdate) {
      ui.notifications.warn(`${MODULE} | tryToUpdateActorWithLinkedDocumentsFromCompendiums | No Actor is been passed`);
      return;
    }

    const compendiumsReferences = parseAsArray(compendiumsToCheck);
    const onlyItems = options.onlyItems ? true : false;
    // e.g. ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'backpack', 'feat']
    const typesToFilter = parseAsArray(options.typesToFilter) ?? [];
    // Unmatched items can be included in this compendium
    const compendiumForNoMatch = options.compendiumForNoMatch ? options.compendiumForNoMatch : "No Linked Documents";

    const compendiums = [];
    for(const ref of compendiumsReferences) {
      const comp = await getCompendiumCollectionAsync(ref, false);
      if(comp) {
        compendiums.push(comp);
      }
    }

    if(!compendiums || compendiums.length === 0) {
      ui.notifications.warn(`${MODULE} | tryToLinkItemsFromCompendium | No Compendiums is been passed with value`);
      return;
    }
    
    const documentsToCheckMap = {};
    for (const pack of compendiums) {
      const documentsRetrieved = await pack.getDocuments();
      if(onlyItems) {
        if(pack.metadata.type === 'Item') {
          documentsRetrieved.forEach((doc) => {
            documentsToCheckMap[doc.name] ??= [];
            documentsToCheckMap[doc.name].push(doc);
          });
        } else {
          // Do nothing
        }
      } else {
        documentsRetrieved.forEach((doc) => {
          documentsToCheckMap[doc.name] ??= [];
          documentsToCheckMap[doc.name].push(doc);
        });
      }
    }

    if (Object.keys(documentsToCheckMap).length === 0) {
      ui.notifications.info(`No documents were found in the compendiums`);
      return;
    }

    // TODO add some more code for manage all the non items document
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
      const alreadyLinked = itemTryToLink.getFlag('item-linking', 'isLinked');
      if (alreadyLinked) {
        documentsAlreadyLinked++;
        const broken_link = !Boolean(await fromUuid(itemTryToLink.getFlag('item-linking', 'baseItem')));
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
        ui.notifications.error(`Compendium ${compendiumForNoMatch} not found`);
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
      ui.notifications.info(`<b>${unique_no_match.length}</b> items created and <b>${items_fixed}</b> items linked`, {
        permanent: true,
      });
    }
  },

  isItemLinked(itemToCheck) {
    const isLinked = itemToCheck.getFlag("item-linking", "baseItem");
    if (isLinked) {
      return true;
    }
    return false;
  },

  retrieveLinkedItem(itemToCheck) {
    if (!this.isItemLinked(itemToCheck)) {
      warn(`The item ${itemToCheck.name}|${itemToCheck.uuid} is not linked`);
      return null;
    }
    const baseItemUuid = itemToCheck.getFlag("item-linking", "baseItem");
    if (!baseItemUuid) {
      warn(`No baseItemUuid is been found for ${itemToCheck.name}|${itemToCheck.uuid}`);
      return null;
    }
    const baseItem = fromUuidSync(baseItemUuid);
    if (!baseItem) {
      warn(`No baseItem is been found for ${itemToCheck.name}|${itemToCheck.uuid}`);
      return null;
    }
    return baseItem;
  }
};

export default API;
