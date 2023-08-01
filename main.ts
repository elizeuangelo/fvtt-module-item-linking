import { applyFixes, checkFixes } from './fixes/fixes.js';
import { findDerived } from './module/item.js';
import { getSetting } from './module/settings.js';
import { log } from './module/utils.js';
import('./module/flags.js');
import('./module/compendium.js');
import('./module/actor.js');

Hooks.once('setup', () => {
	import('./module/embedded.js');
});

Hooks.once('ready', async () => {
	log('Successfully Initialized');

	if (checkFixes()) {
		log(`Applying fixes since ${getSetting('update')}...`);
		await applyFixes();
		log(`All fixes applied`);
	}

	// temporary
	const derivations = findDerived();
	log(`${Object.keys(derivations).length} data links derived`);
	//@ts-ignore
	//window.derivations = derivations;
});
