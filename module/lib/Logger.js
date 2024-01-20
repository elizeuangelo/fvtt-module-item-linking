import { MODULE } from "../settings.js";

// ================================
// Logger utility
// ================================
export default class Logger {
  static get DEBUG() {
    return (
      game.settings.get(MODULE, "debug") ||
      game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE, "boolean")
    );
  }
  // export let debugEnabled = 0;
  // 0 = none, warnings = 1, debug = 2, all = 3

  static debug(msg, ...args) {
    try {
      if (
        game.settings.get(MODULE, "debug") ||
        game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE, "boolean")
      ) {
        console.log(`DEBUG | ${MODULE} | ${msg}`, ...args);
      }
    } catch (e) {
      console.error(e.message);
    }
    return msg;
  }

  static logObject(...args) {
    return this.log("", args);
  }

  static log(message, ...args) {
    try {
      message = `${MODULE} | ${message}`;
      console.log(message.replace("<br>", "\n"), ...args);
    } catch (e) {
      console.error(e.message);
    }
    return message;
  }

  static notify(message, ...args) {
    try {
      message = `${MODULE} | ${message}`;
      ui.notifications?.notify(message);
      console.log(message.replace("<br>", "\n"), ...args);
    } catch (e) {
      console.error(e.message);
    }
    return message;
  }

  static info(info, notify = false, ...args) {
    try {
      info = `${MODULE} | ${info}`;
      if (notify) {
        ui.notifications?.info(info);
      }
      console.log(info.replace("<br>", "\n"), ...args);
    } catch (e) {
      console.error(e.message);
    }
    return info;
  }

  static warn(warning, notify = false, ...args) {
    try {
      warning = `${MODULE} | ${warning}`;
      if (notify) {
        ui.notifications?.warn(warning);
      }
      console.warn(warning.replace("<br>", "\n"), ...args);
    } catch (e) {
      console.error(e.message);
    }
    return warning;
  }

  static errorObject(...args) {
    return this.error("", false, args);
  }

  static error(error, notify = true, ...args) {
    try {
      error = `${MODULE} | ${error}`;
      if (notify) {
        ui.notifications?.error(error);
      }
      console.error(error.replace("<br>", "\n"), ...args);
    } catch (e) {
      console.error(e.message);
    }
    return new Error(error.replace("<br>", "\n"));
  }

  static timelog(message) {
    warn(Date.now(), message);
  }

  static i18n = (key) => {
    return game.i18n.localize(key)?.trim();
  };

  static i18nFormat = (key, data = {}) => {
    return game.i18n.format(key, data)?.trim();
  };

  // setDebugLevel = (debugText): void => {
  //   debugEnabled = { none: 0, warn: 1, debug: 2, all: 3 }[debugText] || 0;
  //   // 0 = none, warnings = 1, debug = 2, all = 3
  //   if (debugEnabled >= 3) CONFIG.debug.hooks = true;
  // };

  static dialogWarning(message, icon = "fas fa-exclamation-triangle") {
    return `<p class="${MODULE}-dialog">
        <i style="font-size:3rem;" class="${icon}"></i><br><br>
        <strong style="font-size:1.2rem;">${MODULE}</strong>
        <br><br>${message}
    </p>`;
  }
}
