// Notify the content script that the injected script has loaded
window.postMessage(
  { type: "FROM_INJECTED_SCRIPT", action: "SCRIPT_LOADED" },
  "*"
);

// Save the original fetch function
const originalFetch = window.fetch;

// Override the global fetch function
window.fetch = async function (input, init) {
  let requestUrl = "";
  let requestMethod = "GET"; // Default method

  // Determine URL and method from the input
  if (typeof input === "string") {
    requestUrl = input;
    if (init && init.method) {
      requestMethod = init.method.toUpperCase();
    }
  } else if (input instanceof Request) {
    requestUrl = input.url;
    requestMethod = input.method ? input.method.toUpperCase() : "GET";
  }

  // If this is a POST request to the conversation endpoint, ask for confirmation
  if (
    requestUrl.includes("/backend-anon/conversation") &&
    requestMethod === "POST"
  ) {
    // Parse the payload (assume JSON)
    let payload;
    try {
      payload = JSON.parse(init.body);
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return originalFetch(input, init);
    }

    // Only intercept if the payload action is "next"
    if (payload["action"] !== "next") {
      return originalFetch(input, init);
    }

    const query =
      payload.messages &&
      payload.messages[0] &&
      payload.messages[0].content &&
      payload.messages[0].content.parts &&
      payload.messages[0].content.parts[0]
        ? payload.messages[0].content.parts[0]
        : "";

    console.log("QUERY IS:", query);
    // Show confirmation dialog and wait for the user's choice.
    const result = await showConfirmationDialog(query);

    if (result.option === "cancel") {
      return Promise.reject(new Error("User cancelled the request."));
    } else if (result.option === "cloud") {
      // Remove the modal overlay (if not already removed) and run the original query.
      if (result.overlay && document.body.contains(result.overlay)) {
        document.body.removeChild(result.overlay);
      }
      return originalFetch(input, init);
    } else if (result.option === "local") {
      // Instead of directly calling localhost, send a message to the content script
      // which will forward it to the background script
      let localResponseText = "";
      try {
        // Send a message to the content script
        window.postMessage(
          {
            type: "FROM_INJECTED_SCRIPT",
            action: "RUN_LOCAL",
            payload: {
              query: query,
            },
          },
          "*"
        );

        // Wait for the response from the content script
        const response = await new Promise((resolve, reject) => {
          const messageHandler = (event) => {
            if (
              event.data &&
              event.data.type === "FROM_CONTENT_SCRIPT" &&
              event.data.action === "LOCAL_RESPONSE"
            ) {
              window.removeEventListener("message", messageHandler);
              if (event.data.success) {
                resolve(event.data.data);
              } else {
                reject(new Error(event.data.error || "Unknown error"));
              }
            }
          };

          window.addEventListener("message", messageHandler);

          // Set a timeout to prevent hanging
          setTimeout(() => {
            window.removeEventListener("message", messageHandler);
            reject(new Error("Timeout waiting for local response"));
          }, 30000); // 30 second timeout
        });

        // Parse the response if it's JSON
        try {
          const parsedResponse = JSON.parse(response);
          localResponseText = parsedResponse.response || response;
        } catch (e) {
          // If it's not JSON, use it as is
          localResponseText = response;
        }

        console.log("Local response:", localResponseText);
      } catch (error) {
        localResponseText = "Error contacting local server: " + error.message;
        console.error("Error getting local response:", error);
      }

      // Update the modal with the local response.
      if (result.overlay) {
        // Clear its content
        result.overlay.innerHTML = "";
        const modal = document.createElement("div");
        modal.className = "gpt-modal";

        const responseTitle = document.createElement("p");
        responseTitle.className = "gpt-response-title";
        responseTitle.textContent = "Local Response:";
        modal.appendChild(responseTitle);

        const responseContent = document.createElement("pre");
        responseContent.className = "gpt-response";
        responseContent.textContent = localResponseText;
        modal.appendChild(responseContent);

        const closeButton = document.createElement("button");
        closeButton.className = "gpt-close-button";
        closeButton.textContent = "Close";
        closeButton.addEventListener("click", () => {
          if (document.body.contains(result.overlay)) {
            document.body.removeChild(result.overlay);
          }
        });
        modal.appendChild(closeButton);

        result.overlay.appendChild(modal);
      }

      // Return a dummy Response object that mimics an event-stream response.
      return new Response(localResponseText, {
        status: 200,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      });
    }
  }

  // For all other requests, call the original fetch.
  return originalFetch(input, init);
};

// Function to show a confirmation dialog with three options: Run on Cloud, Run Locally, and Cancel.
function showConfirmationDialog(query) {
  return new Promise((resolve) => {
    // Create full-screen overlay
    const overlay = document.createElement("div");
    overlay.className = "gpt-overlay";

    // Create modal box
    const modal = document.createElement("div");
    modal.className = "gpt-modal";

    // Modal title
    const title = document.createElement("p");
    title.className = "gpt-title";
    title.textContent = "Are you sure?";
    modal.appendChild(title);

    // Display the user query for context
    const queryText = document.createElement("p");
    queryText.className = "gpt-query";
    queryText.textContent = query;
    modal.appendChild(queryText);

    // Create buttons container
    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "gpt-buttons";

    // "Run on Cloud" button
    const runCloudButton = document.createElement("button");
    runCloudButton.className = "gpt-button gpt-cloud-button";
    runCloudButton.textContent = "Run on Cloud";
    buttonsDiv.appendChild(runCloudButton);

    // "Run Locally" button
    const runLocalButton = document.createElement("button");
    runLocalButton.className = "gpt-button gpt-local-button";
    runLocalButton.textContent = "Run Locally";
    buttonsDiv.appendChild(runLocalButton);

    // "Cancel" button
    const cancelButton = document.createElement("button");
    cancelButton.className = "gpt-button gpt-cancel-button";
    cancelButton.textContent = "Cancel";
    buttonsDiv.appendChild(cancelButton);

    modal.appendChild(buttonsDiv);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Set up event listeners for each option.
    runCloudButton.addEventListener("click", () => {
      // Remove overlay and resolve with cloud option.
      document.body.removeChild(overlay);
      resolve({ option: "cloud", overlay: null });
    });
    runLocalButton.addEventListener("click", () => {
      // Do not remove the overlay immediately; pass it along so the response can be injected.
      resolve({ option: "local", overlay: overlay });
    });
    cancelButton.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve({ option: "cancel", overlay: null });
    });
  });
}
