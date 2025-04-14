// Only run once even if content.js is re-injected.
if (!window.myExtensionInitialized) {
  window.myExtensionInitialized = true;

  // Helper: Create overlay pop-up with the prompt and buttons.
  function createPopup(promptText) {
    return new Promise((resolve) => {
      // Create the overlay if it doesn't already exist.
      let overlay = document.getElementById("my-extension-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "my-extension-overlay";
        Object.assign(overlay.style, {
          position: "fixed",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: "9999",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        });
        document.body.appendChild(overlay);
      }

      // Create the pop-up container with a unique id.
      const container = document.createElement("div");
      container.id = "my-extension-popup-container";
      Object.assign(container.style, {
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        width: "80%",
        maxWidth: "500px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      });

      // Add prompt text.
      const promptPara = document.createElement("p");
      promptPara.textContent = "Extracted prompt: " + promptText;
      promptPara.style.marginBottom = "20px";
      container.appendChild(promptPara);

      // Create buttons container.
      const btnContainer = document.createElement("div");
      btnContainer.style.display = "flex";
      btnContainer.style.justifyContent = "space-around";

      // "Run on Cloud" button.
      const cloudBtn = document.createElement("button");
      cloudBtn.textContent = "Run on Cloud";
      cloudBtn.style.padding = "10px 20px";
      cloudBtn.style.cursor = "pointer";
      cloudBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve("cloud");
      });

      // "Run Locally" button.
      const localBtn = document.createElement("button");
      localBtn.textContent = "Run Locally";
      localBtn.style.padding = "10px 20px";
      localBtn.style.cursor = "pointer";
      localBtn.addEventListener("click", () => {
        // Instead of removing the overlay, update it with a response view.
        container.innerHTML = ""; // Clear current content.

        // Re-display the prompt text (optional).
        const promptDisplay = document.createElement("p");
        promptDisplay.textContent = "Extracted prompt: " + promptText;
        promptDisplay.style.marginBottom = "10px";
        container.appendChild(promptDisplay);

        // Create a container for streaming response output.
        const responseDiv = document.createElement("div");
        responseDiv.id = "local-stream-output";
        Object.assign(responseDiv.style, {
          border: "1px solid #ccc",
          padding: "10px",
          marginBottom: "10px",
          maxHeight: "200px",
          overflowY: "auto",
          textAlign: "left",
          fontFamily: "Courier New, monospace",
          fontSize: "14px",
          whiteSpace: "pre-wrap",
        });
        container.appendChild(responseDiv);

        // Create a close button to allow dismissal of the popup.
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Close";
        closeBtn.style.padding = "10px 20px";
        closeBtn.style.cursor = "pointer";
        closeBtn.addEventListener("click", () => {
          document.body.removeChild(overlay);
        });
        container.appendChild(closeBtn);

        resolve("local");
      });

      btnContainer.appendChild(cloudBtn);
      btnContainer.appendChild(localBtn);
      container.appendChild(btnContainer);
      overlay.appendChild(container);
    });
  }

  // Listen for the popup request from the injected script.
  window.addEventListener("ExtensionPopupRequest", async (event) => {
    if (event.detail && event.detail.prompt) {
      const promptText = event.detail.prompt;
      const decision = await createPopup(promptText);
      const responseEvent = new CustomEvent("ExtensionPopupResponse", {
        detail: { decision },
      });
      window.dispatchEvent(responseEvent);
    }
  });

  // Listen for request to perform the local API call.
  window.addEventListener("PerformLocalRequest", async (event) => {
    if (event.detail && event.detail.prompt) {
      const promptText = event.detail.prompt;
      const apiUrl = "http://localhost:11434/api/generate";
      const apiPayload = {
        model: "llama3.2:1b",
        prompt: promptText,
        stream: true,
      };
      try {
        const localResponse = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload),
        });

        // Instead of creating a new output overlay, update the response container in the existing popup.
        const responseDiv = document.getElementById("local-stream-output");
        if (!responseDiv) {
          console.error("Response container not found");
          return;
        }

        // Process the streaming response.
        const reader = localResponse.body.getReader();
        const decoder = new TextDecoder();
        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) return;
            const chunk = JSON.parse(decoder.decode(value)).response;
            // Append stream chunk to responseDiv.
            responseDiv.textContent += chunk;
            // Optionally scroll to the bottom.
            responseDiv.scrollTop = responseDiv.scrollHeight;
            readStream();
          });
        }
        readStream();
      } catch (err) {
        console.error("Error making local API call:", err);
      }
    }
  });

  // Inject the external script (injected.js) into the page context.
  // Use a unique id to avoid duplicate injections.
  if (!document.getElementById("my-extension-injected-script")) {
    const script = document.createElement("script");
    script.id = "my-extension-injected-script";
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
}
