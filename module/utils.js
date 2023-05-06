import { TITLE } from './settings.js';
export const log = (message) => {
    console.log(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const warn = (message) => {
    console.warn(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const error = (message) => {
    console.error(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
