((global, DOM, chrome) => {
  "use strict";
  
  /**
  * Given a requestMethod and requestUrl, obtains a response 
  *   back.
  * @param {String} requestMethod
  * @param {String} requestUrl
  * @returns {Promise} Resolves on 2** and 3** status code responses 
  *   rejects otherwise
  */
  function request(requestMethod, requestUrl, {
    requestBody, requestHeaderMap
  } = {requestHeaderMap: {}}) {
    var webRequest = new XMLHttpRequest(),
        requestMethodNormalized = requestMethod.toUpperCase();
    
    return new Promise((resolve, reject) => {
      // Not a valid request method? Reject
      switch (requestMethodNormalized) {
        case "GET":
        case "POST":
        case "PUT":
        case "DELETE":
          break;
        default:
          reject(new Error("Request Method not supported."));
      }
      
      // Closure to track if some point in time is reached
      //  If the time is reached, cancel
      function timeTracker (milliseconds, callableOnTimeOut) {
        var timeOutDuration = Math.ceil(milliseconds);
        if (timeOutDuration < 0) {
          throw new Error("Positive or zero Number required");
        }
        if (typeof callableOnTimeOut !== "function") {
          throw new Error("Function required");
        }
        
        var timeReached = false,
            setTimeoutReference = setTimeout(() => {
              timeReached = true;
              callableOnTimeOut();
            }, timeOutDuration);
        
        return {
          cancel: function () { 
            clearTimeout(setTimeoutReference);
          },
          isTimeOut: function () {
            return timeReached;
          }
        };
      }
      
      var logTime = timeTracker(10000, () => {
        webRequest.onreadystatechange = () => {};
        webRequest.abort();
        reject(new Error("Request Timeout"));
      }),
          requestHeaderMapNormalized = Object.assign({
            "Content-type": "application/x-www-form-urlencoded"
          }, requestHeaderMap);
      
      webRequest.open(requestMethodNormalized, requestUrl, true);
      Object
        .keys(requestHeaderMapNormalized)
        .forEach((requestHeaderKey) => {
          webRequest
            .setRequestHeader(
              requestHeaderKey, 
              requestHeaderMapNormalized[requestHeaderKey]
            );
        });
      webRequest.onreadystatechange = () => {
        if (webRequest.readyState !== XMLHttpRequest.DONE) {
          return;
        }
        logTime.cancel();
        
        var statusCode = webRequest.status, 
            responseType = 
            webRequest.getResponseHeader("Content-Type"), 
            content = webRequest.response;
        
        try {
          var parsedJson = JSON.parse(content);
          content = parsedJson;
        } catch (error) {}
        
        var responsePacket = {
          statusCode,
          responseType,
          content
        };
        
        if (statusCode >= 400 || statusCode === 0) {
          reject(responsePacket);
          return;
        }
        
        resolve(responsePacket);
      };
      webRequest.send(requestBody);
    });
  }
  
  /**
  * Synchronously store data across all Chrome browsers of a user.
  *   @param {Object} storeObject
  *   @returns {Promise}
  */
  function chromeStoreData(storeObject) {
    return new Promise((res) => chrome.runtime.sendMessage({
      type: "saveObject",
      payload: storeObject
    }, res));
  }
  
  /**
  * Access stored values (based on the keys of default object). If 
  *   that key does not exist, use the provided default value
  *   @param {Object} defaultObject
  *   @returns {Promise}
  */
  function chromeGetData(defaultObject) {
    return new Promise((res) => chrome.runtime.sendMessage({
      type: "getObject",
      payload: defaultObject
    }, res));
  }
  
  /**
  * Debounces the given callable for n milliseconds
  * @param {Number} milliseconds
  * @param {Function} callable
  * @returns {Function} Debounced Function
  */
  function debounce(callable, milliseconds=500) {
    let setTimeoutRef = null;
    return () => {
      const context = this,
            args = arguments;
      
      if (setTimeoutRef !== null) {
        clearTimeout(setTimeoutRef);
      }
      setTimeoutRef = setTimeout(() => {
        setTimeoutRef = null;
        callable.apply(context, args);
      }, milliseconds);
    };
  }
  
  
  // ------------ Actual Extension StreamFuncs -------------------
  
  /**
  * Acquire Clarifai access token
  * @returns {Promise}
  */
  function acquireSettings() {
    return chromeGetData({
      client_id: "_i_fXNjWbPbUmQYNTjdLTPVBeU5X7DU8MwWoPSZ9",
      client_secret: "_UBHRS-peR0AAfVbN1qNE6ib3QrkFmh778gvSYGZ",
      access_token: null,
      access_token_exp: null,
      rating_basis: 0.7
    }).then(({client_id, client_secret, access_token, 
              access_token_exp, rating_basis}) => {
      if (access_token !== null && 
          typeof access_token === "string" && 
          Number(access_token_exp) > (new Date()).getTime()) {
        return {
          access_token,
          ratingBasis: rating_basis
        };
      }
      
      return request("POST", 
                     "https://api.clarifai.com/v1/token", {
        requestBody: "client_id=" + client_id + "&client_secret=" + 
          client_secret + "&grant_type=client_credentials"
      }).then(({content}) => {
        const accessToken = content.access_token,
              expirationTime = new Date().setSeconds(
                Number(content.expires_in) - 7200
              );
        
        chromeStoreData({
          access_token: accessToken,
          access_token_exp: expirationTime.getTime()
        });
        
        return {
          accessToken,
          ratingBasis: rating_basis
        };
      });
    });
  }
  
  /**
  * Obtains DOM images in the CdT timeline as a list
  *   Only returns images that are content-based
  * @returns {Array} List of DOM image nodes
  */
  function obtainImagesAsList() {
    const regex = new RegExp(/CirqueDuTwerque|cdt/i);
    if (!regex.test(window.location.href)) {
      return [];
    }
    
    return (Array.prototype.slice.call(
      DOM.querySelectorAll("#mainContainer #contentCol " + 
                           "#pagelet_group_ img")
    )).filter((domImg) => 
              !(new RegExp(/UFIActorImage/i).test(domImg.className)));
  }
  
  /**
  * Checks if the provided url is safe or unsafe
  * @param {String} imgUrl
  * @param {String} accessToken
  * @param {Number} ratingBasis - Number between 0 and 1
  * @returns {Promise} Boolean on resolve - TRUE if NSFW, FALSE if SFW
  */
  function nsfwUrlTest(imgUrl, accessToken, ratingBasis) {
    var requestUrl = 
        "https://api.clarifai.com/v1/tag/?model=nsfw-v1.0&url=" + 
        imgUrl;
    
    return request("POST", requestUrl, {
      requestHeaderMap: {
        "Authorization": "Bearer " + accessToken
      }
    }).then(({content}) => {
      const probabilityNsfw = 
            content.results[0].result.tag.probs[1];
      
      if (typeof probabilityNsfw !== "number") {
        throw new Error("Cannot rate image");
      }
      
      return (probabilityNsfw >= ratingBasis);
    });
  }
  
  /**
  * Contains main application state and 
  *   actual program execution
  */
  function _main_() {
    const pastImages = {};
    
    return () => {
      acquireSettings()
        .then(({accessToken, ratingBasis}) => {
          obtainImagesAsList()
            .filter((domImg) => {
              // Use cached NSFW rating
              if (domImg.src in pastImages) {
                return pastImages[domImg.src];
              }
              
              const isNsfw = nsfwUrlTest(domImg.src, 
                                         accessToken, 
                                         ratingBasis);
              // Cache NSFW rating
              pastImages[domImg.src] = isNsfw;
              return isNsfw;
            })
            .forEach((domImg) => domImg.remove());
        });
    };
  }
  
  // Bootstrap contained main application state
  chromeStoreData({"extension_enabled": true}).then(() => {
    const runMain = _main_();
    
    runMain();
    global.addEventListener('scroll', debounce(runMain));
  });
  
}(window, window.document, window.chrome));