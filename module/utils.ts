import { TITLE } from './settings.js';

export const log = (message: string) => {
	console.log(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const warn = (message: string) => {
	console.warn(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
export const error = (message: string) => {
	console.error(`%c${TITLE} %c| ${message}`, 'color:orange;font-weight:bold', '');
};
