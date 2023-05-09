import { derivations, derivationsIds } from './module/item.js';
import { log } from './module/utils.js';
import('./module/flags.js');
import('./module/compendium.js');
import('./module/actor.js');

Hooks.once('ready', () => {
	log('Successfully Initialized');
	log(`${derivationsIds.size} data links derived`);
	//@ts-ignore
	window.derivations = derivations;
	//@ts-ignore
	window.derivationsId = derivationsIds;
});
