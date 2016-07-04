function bootstrap() {
  "use strict";
  
  const chrome = window.chrome;
  
  function saveClarifaiId(newId) {
    activateUiMessage();
    chrome.storage.sync.set({
      "client_id": newId
    });
  }
  function saveClarifaiSecret(newSecret) {
    activateUiMessage();
    chrome.storage.sync.set({
      "client_secret": newSecret
    });
  }
  function saveExtensionEnabled(isEnabled) {
    activateUiMessage();
    chrome.storage.sync.set({
      "extension_enabled": isEnabled
    });
  }
  function activateUiMessage() {
    const uiMessageDOM = window.document.getElementById("uiMessage");

    uiMessageDOM.style.cssText = null;

    setTimeout(() => {
      uiMessageDOM.style.cssText = "display:none;";
    }, 1000);
  }

  // Attach event listeners
  const clarifaiIdDOM = 
        window.document.getElementById("clarifai_id");
  clarifaiIdDOM.addEventListener("keyup", () => 
                                 saveClarifaiId(clarifaiIdDOM.value));

  const clarifaiSecretDOM = 
        window.document.getElementById("clarifai_secret");
  clarifaiSecretDOM.addEventListener("keyup", () => 
                                     saveClarifaiSecret(
    clarifaiSecretDOM.value
  ));

  const isEnabledDOM = 
        window.document.getElementById("enabledButton");
  isEnabledDOM.addEventListener("change", () => {
    if (isEnabledDOM.checked === true) {
      saveExtensionEnabled(true);
      return;
    }

    saveExtensionEnabled(false);
  });

  // Add default configuration
  chrome.storage.sync.get({
    "client_id": "_i_fXNjWbPbUmQYNTjdLTPVBeU5X7DU8MwWoPSZ9",
    "client_secret": "_UBHRS-peR0AAfVbN1qNE6ib3QrkFmh778gvSYGZ",
    "extension_enabled": true
  }, ({client_id, client_secret, extension_enabled}) => {
    clarifaiIdDOM.value = client_id;
    clarifaiSecretDOM.value = client_secret;
    if (Boolean(extension_enabled)) {
      isEnabledDOM.checked = true;
    } else {
      isEnabledDOM.checked = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);