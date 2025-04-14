// Only run once even if content.js is re-injected.
if (!window.myExtensionInitialized) {
  window.myExtensionInitialized = true;

  // Helper: Create overlay pop-up with the prompt and buttons.
  function createPopup(promptText) {
    return new Promise((resolve) => {
      // Create the overlay if it doesn't already exist.
      let overlay = document.getElementById("greenpoint-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "greenpoint-overlay";
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
      container.id = "greenpoint-popup-container";
      Object.assign(container.style, {
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        width: "50%",
        maxWidth: "500px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        fontFamily: "Arial, sans-serif",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
      });

      const header = document.createElement("h2");
      header.textContent = "Are you sure?";
      container.appendChild(header);

      const subtitle = document.createElement("p");
      subtitle.textContent = "We estimate this query will consume:";
      container.appendChild(subtitle);

      const title_spacer = document.createElement("div");
      title_spacer.style.height = "15px";
      container.appendChild(title_spacer);

      // Create resource impact information

      // Calculate tokens and energy usage
      const tokens = promptText.length / 4; // Fixed: length is a property, not a function
      // Format numbers in scientific notation with fixed precision
      const formatScientific = (num) => {
        if (num < 0.0001 || num > 10000) {
          // For very small or large numbers, use scientific notation
          const exp = Math.floor(Math.log10(num));
          const coef = num / Math.pow(10, exp);
          return `${coef.toFixed(3)} × 10<sup>${exp}</sup>`;
        } else {
          // For medium-sized numbers, use standard notation with fixed precision
          return num.toFixed(6);
        }
      };

      const energy_usage = 1.18 * Math.pow(10, -5) * Math.pow(tokens, 2);
      const water_usage = 5.9 * Math.pow(10, -9) * Math.pow(tokens, 2);
      const carbon_usage = 1.31 * Math.pow(10, -9) * Math.pow(tokens, 2);

      const resources = [
        {
          emoji: "⚡",
          label: `${formatScientific(energy_usage)} joules of electricity`,
        },
        {
          emoji: "💧",
          label: `${formatScientific(water_usage)} milliliters of water`,
        },
        {
          emoji: "🏭",
          label: `${formatScientific(carbon_usage)} grams of CO2`,
        },
      ];

      // Add each resource row to the container
      resources.forEach((resource) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          margin: "8px 0",
          width: "100%",
        });

        // Add the emoji
        const emoji = document.createElement("span");
        emoji.textContent = resource.emoji;
        emoji.style.fontSize = "36px";
        emoji.style.marginRight = "10px";

        // Add the label
        const label = document.createElement("span");
        label.innerHTML = resource.label;
        label.style.fontSize = "18px";

        row.appendChild(emoji);
        row.appendChild(label);
        container.appendChild(row);
      });

      // Add some spacing after the resources
      const spacer = document.createElement("div");
      spacer.style.height = "15px";
      container.appendChild(spacer);

      // Create buttons container.
      const btnContainer = document.createElement("div");
      btnContainer.style.display = "flex";
      btnContainer.style.justifyContent = "space-around";

      // "Run on Cloud" button.
      const cloudBtn = document.createElement("button");
      cloudBtn.textContent = "Run on Cloud";
      Object.assign(cloudBtn.style, {
        padding: "10px 20px",
        cursor: "pointer",
        backgroundColor: "#e74c3c", // Red background
        color: "white",
        border: "none",
        borderRadius: "8px",
        margin: "0 10px",
        fontWeight: "bold",
        transition: "background-color 0.2s ease",
      });
      cloudBtn.addEventListener("mouseover", () => {
        cloudBtn.style.backgroundColor = "#c0392b"; // Darker red on hover
      });
      cloudBtn.addEventListener("mouseout", () => {
        cloudBtn.style.backgroundColor = "#e74c3c"; // Original red
      });
      cloudBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve("cloud");
      });

      // "Run Locally" button.
      const localBtn = document.createElement("button");
      localBtn.textContent = "Run Locally";
      Object.assign(localBtn.style, {
        padding: "10px 20px",
        cursor: "pointer",
        backgroundColor: "#2ecc71", // Green background
        color: "white",
        border: "none",
        borderRadius: "8px",
        margin: "0 10px",
        fontWeight: "bold",
        transition: "background-color 0.2s ease",
      });
      localBtn.addEventListener("mouseover", () => {
        localBtn.style.backgroundColor = "#27ae60"; // Darker green on hover
      });
      localBtn.addEventListener("mouseout", () => {
        localBtn.style.backgroundColor = "#2ecc71"; // Original green
      });
      localBtn.addEventListener("click", () => {
        document.body.removeChild(overlay);
        resolve("local");
      });

      // Center buttons in container
      btnContainer.style.width = "100%";
      btnContainer.style.justifyContent = "center";

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

  window.ollamaConversation = window.ollamaConversation || [];

  window.addEventListener("PerformLocalRequest", async (event) => {
    if (event.detail && event.detail.prompt) {
      const promptText = event.detail.prompt;

      // Append the new user message to the conversation history.
      window.ollamaConversation.push({
        role: "user",
        content: promptText,
      });

      // Switch the endpoint to the chat API.
      const apiUrl = "http://localhost:11434/api/chat";
      // Build the payload with the entire conversation history.
      const apiPayload = {
        model: "llama3.2:1b",
        messages: window.ollamaConversation,
        stream: true,
      };

      try {
        const localResponse = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload),
        });

        // (Optional) Continue to use your UI update code.
        const threadContainer = document.querySelector(
          'div[class="@thread-xl/thread:pt-header-height mt-1.5 flex flex-col text-sm"]'
        );
        const lastArticle = threadContainer.querySelector(
          "article:last-of-type"
        );
        const original_pTag = lastArticle.querySelector("p:first-of-type");
        const cloned_pTag = original_pTag.cloneNode(true);
        original_pTag.parentNode.insertBefore(cloned_pTag, original_pTag);
        cloned_pTag.style.color = "green";
        original_pTag.style.display = "none";

        const reader = localResponse.body.getReader();
        const decoder = new TextDecoder();

        // Use a temporary variable to accumulate the assistant's full response.
        let assistantMessage = "";

        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) return;
            const jsonData = JSON.parse(decoder.decode(value));

            // The chat endpoint returns a message object instead of a plain "response" field.
            let chunk = "";
            if (jsonData.message && jsonData.message.content) {
              chunk = jsonData.message.content;
            } else if (jsonData.response) {
              chunk = jsonData.response;
            }
            // Accumulate the assistant's message.
            assistantMessage += chunk;

            // Update the UI by properly handling newlines
            if (chunk) {
              // First, clear the paragraph and create a proper HTML content
              if (!cloned_pTag.hasAttribute("data-processed")) {
                cloned_pTag.innerHTML = "";
                cloned_pTag.setAttribute("data-processed", "true");
              }

              // Convert newlines to <br> tags and append to innerHTML
              chunk = chunk.replace(/\n/g, "<br>");
              cloned_pTag.innerHTML += chunk;
            }

            // Check if this is the final chunk.
            if (jsonData.done === true) {
              // At the end of the stream, push the complete assistant message to the conversation.
              window.ollamaConversation.push({
                role: "assistant",
                content: assistantMessage,
              });
            }
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
  if (!document.getElementById("greenpoint-injected-script")) {
    const script = document.createElement("script");
    script.id = "greenpoint-injected-script";
    script.src = chrome.runtime.getURL("injected.js");
    script.onload = function () {
      script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
}
