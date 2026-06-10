import { applyFixes, checkFixes } from './fixes/fixes.js';
import { findDerived } from './module/item.js';
import { MODULE_ID, getSetting } from './module/settings.js';
import Logger from './module/lib/Logger.js';
import API from './module/api.js';
import LinkedItemResolver from './module/link-resolver.js';
import { initializeSystemSupport } from './module/system.js';
import './module/compendium.js';
import './module/actor.js';
import './module/item-overrides.js';
import './module/item-link-compendium-button.js';
import './module/core.js';

Hooks.once('setup', async () => {
	await initializeSystemSupport();
	await import('./module/embedded.js');
	const data = game.modules.get(MODULE_ID);
	data.api = API;
});

Hooks.once('ready', async () => {
	await initializeSystemSupport();
	Logger.log('Successfully Initialized');
	if (checkFixes()) {
		Logger.log(`Applying fixes since ${getSetting('update')}...`);
		await applyFixes();
		Logger.log(`All fixes applied`);
	}
	const derivations = findDerived();
	Logger.log(`${Object.keys(derivations).length} data links derived`);
	const hydrated = await LinkedItemResolver.hydrateAll();
	Logger.log(`${hydrated} linked items hydrated`);
});
