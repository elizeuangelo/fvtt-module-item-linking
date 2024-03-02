import { applyFixes, checkFixes } from './fixes/fixes.js';
import { findDerived } from './module/item.js';
import { MODULE_ID, getSetting } from './module/settings.js';
import Logger from './module/lib/Logger.js';
import API from './module/api.js';
import './module/compendium.js';
import './module/actor.js';
import './module/item-overrides.js';

Hooks.once('setup', () => {
	import('./module/embedded.js');
	const data = game.modules.get(MODULE_ID);
	data.api = API;
});

Hooks.once('ready', async () => {
	Logger.log('Successfully Initialized');
	if (checkFixes()) {
		log(`Applying fixes since ${getSetting('update')}...`);
		await applyFixes();
		log(`All fixes applied`);
	}
	const derivations = findDerived();
	Logger.log(`${Object.keys(derivations).length} data links derived`);
});
