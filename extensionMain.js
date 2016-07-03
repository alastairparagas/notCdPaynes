((chrome) => {
  "use strict";
  
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      
      switch (message.type) {
          
        case "saveObject":
          chrome.storage.sync.set(message.payload, sendResponse);
          break;
          
        case "getObject":
          chrome.storage.sync.get(message.payload, sendResponse);
          break;
        
      }
      
      return true;
    }
  );
  
}(window.chrome));