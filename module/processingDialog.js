/**
 * A wrapper for entering a Dialog into processing mode.
 * Processing mode disables all buttons in the dialog, removes the close button
 * and replaces the processor button with a loading spinner.
 * The icon and label of the button can be replaced on demand.
 * @class
 */
export class ProcessingDialog {
	constructor(dialog, buttonId) {
		this.dialog = dialog;
		this.buttonId = buttonId ?? Object.keys(dialog.data.buttons)[0];
		this.buttonData = dialog.data.buttons[this.buttonId];
		this.#replaceSubmit();
	}

	/**
	 * Disables all buttons in the dialog.
	 */
	#disableButtons() {
		this.dialog.element.find('button').prop('disabled', true);
	}

	/**
	 * Disables the close button in the dialog header.
	 */
	#disableCloseButton() {
		this.dialog.element.find('a.header-button').remove();
	}

	/**
	 * Handles the submit event for the dialog.
	 *
	 * @param {HTMLElement} button - The button element that triggered the submit event.
	 * @param {Event} event - The submit event object.
	 * @returns {void}
	 */
	_newSubmit(button, event) {
		if (this.buttonData === button) {
			const target = this.dialog.options.jQuery ? this.dialog.element : this.dialog.element[0];
			try {
				if (button.callback) button.callback.call(this.dialog, target, event, this);
			} catch (err) {
				ui.notifications.error(err);
			}
			return;
		}
		return Dialog.prototype.submit.call(this.dialog, button, event);
	}

	/**
	 * Replaces the submit function of the dialog with a new submit function.
	 * @private
	 */
	#replaceSubmit() {
		this.dialog.submit = this._newSubmit.bind(this);
	}

	/**
	 * Process the given label.
	 * @param {string} label - The label to process.
	 */
	process(label) {
		this.#disableButtons();
		this.#disableCloseButton();
		this.icon = 'fa-solid fa-spinner fa-spin-pulse';
		if (label) this.label = label;
	}

	/**
	 * Closes the dialog.
	 */
	close() {
		this.dialog.close();
	}

	get button() {
		return this.dialog.element.find(`button[data-button="${this.buttonId}"]`);
	}

	get icon() {
		return this.button.find('i')[0].classList.value;
	}
	set icon(value) {
		this.button.find('i')[0].classList.value = value;
	}

	get label() {
		return this.button[0].childNodes[2].textContent;
	}
	set label(value) {
		this.button[0].childNodes[2].textContent = value;
	}
}
