import { findDerived } from './module/item.js';
import { log } from './module/utils.js';
import('./module/flags.js');
import('./module/compendium.js');
Hooks.once('setup', () => {
    import('./module/embedded.js');
});
Hooks.once('ready', () => {
    log('Successfully Initialized');
    const derivations = findDerived();
    log(`${Object.keys(derivations).length} data links derived`);
    window.derivations = derivations;
});
