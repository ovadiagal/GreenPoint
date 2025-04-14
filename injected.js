(function () {
  // Only override fetch once.
  if (window.__myExtensionFetchOverridden) return;
  window.__myExtensionFetchOverridden = true;

  const originalFetch = window.fetch;

  // Helper to get the user decision via custom events.
  function getUserDecision(promptText) {
    return new Promise((resolve) => {
      function handler(event) {
        window.removeEventListener("ExtensionPopupResponse", handler);
        resolve(event.detail.decision);
      }
      window.addEventListener("ExtensionPopupResponse", handler);

      const reqEvent = new CustomEvent("ExtensionPopupRequest", {
        detail: { prompt: promptText },
      });
      window.dispatchEvent(reqEvent);
    });
  }

  // Override window.fetch to intercept ChatGPT requests.
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input.url;

    if (
      url.includes("chatgpt.com/backend-anon/conversation") &&
      init &&
      init.method &&
      init.method.toUpperCase() === "POST"
    ) {
      try {
        const bodyText = init.body;
        const parsedBody = JSON.parse(bodyText);
        const promptText = parsedBody?.messages?.[0]?.content?.parts?.[0];

        if (promptText) {
          const decision = await getUserDecision(promptText);

          if (decision === "cloud") {
            return originalFetch(input, init);
          } else if (decision === "local") {
            // Dispatch event to perform the local API call.
            const localEvent = new CustomEvent("PerformLocalRequest", {
              detail: { prompt: promptText },
            });
            window.dispatchEvent(localEvent);

            return new Response("Responding Locally", {
              status: 200,
              headers: { "Content-Type": "text/event-stream; charset=utf-8" },
            });
          }
        }
      } catch (err) {
        console.error("Error in fetch interceptor:", err);
        return originalFetch(input, init);
      }
    }
    return originalFetch(input, init);
  };
})();
