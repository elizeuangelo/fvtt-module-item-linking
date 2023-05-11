import { derivations } from './module/item.js';
import { log } from './module/utils.js';
import('./module/flags.js');
import('./module/compendium.js');
import('./module/actor.js');
Hooks.once('ready', () => {
    log('Successfully Initialized');
    log(`${derivations.size} data links derived`);
    window.derivations = derivations;
});
