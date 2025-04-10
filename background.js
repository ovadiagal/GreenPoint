// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("ChatGPT Confirmation Popup extension installed");
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOG") {
    console.log("Message from content script:", message.data);
  }

  if (message.action === "runLocal") {
    // Format the payload for the local server
    const formattedPayload = {
      prompt: message.payload.query,
      // Add any other required fields for your local server
    };

    console.log("Sending to local server:", formattedPayload);

    fetch("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formattedPayload),
    })
      .then((response) => response.text())
      .then((text) => {
        console.log("Local server response:", text);
        sendResponse({ success: true, data: text });
      })
      .catch((error) => {
        console.error("Error calling local server:", error);
        sendResponse({ success: false, error: error.message });
      });
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});
