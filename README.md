# Foundry VTT - Item-Linking

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/elizeuangelo/fvtt-module-item-linking)
![GitHub Releases](https://img.shields.io/github/downloads/elizeuangelo/fvtt-module-item-linking/latest/item-linking.zip)
![GitHub All Releases](https://img.shields.io/github/downloads/elizeuangelo/fvtt-module-item-linking/item-linking.zip?label=downloads)

Enables using compendium items as templates, linking them in a similar way to how linked actors work. Players can edit linked items only partially, most fields are disabled.

Currently only compatible with DnD5e system.

## Installation

In the setup screen, use the manifest URL https://raw.githubusercontent.com/elizeuangelo/fvtt-module-item-linking/master/module.json to install the module.

## How to Use

![Presentation](https://raw.githubusercontent.com/elizeuangelo/fvtt-module-item-linking/master/assets/presentation.gif)

Compendium items become **Templates** and items can now be linked to them.

Dragging a linked item into chat, a journal editor, or a sheet text editor creates a UUID link to its base template, using the dragged item's name (or the editor's custom label). This applies to editors using Foundry's standard content-link creation. Inventory transfers still use the dragged item itself. Unlinked items use their own UUID, and existing text links are unchanged.

Moving an item or folder to another compendium with **Relink Derived Items** checked also updates linked inventory items on actors in all unlocked world Actor compendiums. Packs are loaded for the move even if they have not been opened. Locked packs and packs supplied by modules or systems are skipped; compendium lock states are never changed. Unlock a world Actor compendium before moving to include it in the scan. If a link update fails, the original item or folder is retained; the destination copy and any completed link updates remain.

### Sponsor: [TCR (The Cracked Realms)](https://discord.gg/WNpQn6YtdN)

This module was comissioned for their _Westmeath_ server as they are trying to create an MMO variant of DnD 5e.
You can help them comissioning more MODs: https://ko-fi.com/thecrackedrealms

## API

TODO DOCUMENTATION

```javascript

const actor = ...; // actor to update
const compendiumsFolderToCheck = ['My Compendium Folder Name'] // array of folder names on the compendiums directory
game.modules.get('item-linking').api.tryToUpdateActorWithLinkedDocumentsFromCompendiumFolder(actor, compendiumsFolderToCheck, {
	onlyItems: true,
	typesToFilter: ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'backpack', 'feat'],
	compendiumForNoMatch: 'Miscellaneous'
});
```

```javascript

const actor = ...; // actor to update
const compendiumsToCheck = ...; // array of compendium collection
game.modules.get('item-linking').api.tryToUpdateActorWithLinkedDocumentsFromCompendiums(actor, compendiumsToCheck, {
	onlyItems: true,
	typesToFilter: ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'spell', 'backpack', 'feat'],
	compendiumForNoMatch: 'Miscellaneous'
});
```
