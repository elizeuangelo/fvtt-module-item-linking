import { derivations } from './module/item.js';
import { log } from './module/utils.js';
import('./module/flags.js');
import('./module/compendium.js');

Hooks.once('ready', () => {
	log('Successfully Initialized');
	log(`${Object.keys(derivations).length} data links derived`);
});
