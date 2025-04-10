// Function to inject our resources
function injectResources() {
  // Create a script element with the src pointing to inject.js
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");

  // Add a nonce attribute if available in the page
  const nonce = document.querySelector("script[nonce]")?.nonce;
  if (nonce) {
    script.nonce = nonce;
  }

  // Create a link element for the CSS file
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = chrome.runtime.getURL("popup.css");

  // Append the CSS link to the head
  if (document.head) {
    document.head.appendChild(link);
  } else {
    // If head doesn't exist yet, wait for it
    const observer = new MutationObserver((mutations, obs) => {
      if (document.head) {
        document.head.appendChild(link);
        obs.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Append the script to the page
  (document.head || document.documentElement).appendChild(script);
}

// Check if the document is already loaded
if (document.readyState === "loading") {
  // If not, wait for it to load
  document.addEventListener("DOMContentLoaded", injectResources);
} else {
  // If already loaded, inject immediately
  injectResources();
}

// Listen for messages from the injected script
window.addEventListener(
  "message",
  function (event) {
    // Verify the source of the message
    if (event.source !== window) return;

    // Handle messages from the injected script
    if (event.data && event.data.type === "FROM_INJECTED_SCRIPT") {
      console.log("Message from injected script:", event.data);

      // If the action is RUN_LOCAL, forward it to the background script
      if (event.data.action === "RUN_LOCAL") {
        // Send message to background script
        chrome.runtime.sendMessage(
          {
            action: "runLocal",
            payload: event.data.payload,
          },
          function (response) {
            // Forward the response back to the injected script
            window.postMessage(
              {
                type: "FROM_CONTENT_SCRIPT",
                action: "LOCAL_RESPONSE",
                success: response.success,
                data: response.data,
                error: response.error,
              },
              "*"
            );
          }
        );
      }
    }
  },
  false
);
