const themeToggleButton = document.getElementById("theme-toggle");
const themeIconLight = document.getElementById("theme-icon-light");
const themeIconDark = document.getElementById("theme-icon-dark");

const applyTheme = (theme) => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    themeIconLight.classList.add("hidden");
    themeIconDark.classList.remove("hidden");
  } else {
    document.documentElement.classList.remove("dark");
    themeIconLight.classList.remove("hidden");
    themeIconDark.classList.add("hidden");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
  applyTheme(initialTheme);
});

themeToggleButton.addEventListener("click", () => {
  const isDarkMode = document.documentElement.classList.contains("dark");
  const newTheme = isDarkMode ? "light" : "dark";
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
});

const API_KEYS = {
  gemini: "",
  github: "",
};

const GEMINI_MODELS = {
  "gemini-1.5-flash": "gemini-1.5-flash-latest",
  "gemini-1.5-pro": "gemini-1.5-pro-latest",
};

const GITHUB_MODELS = {
  "github-gpt-4.1": "openai/gpt-4.1",
  "github-gpt-3.5-turbo": "openai/gpt-3.5-turbo",
};

const promptForm = document.getElementById("prompt-form");
const promptInput = document.getElementById("prompt-input");
const submitButton = document.getElementById("submit-button");
const chatHistory = document.getElementById("chat-history");
const modelSelector = document.getElementById("model-selector");

let conversationHistory = [];

promptForm.addEventListener("submit", handleFormSubmit);

promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  const newHeight = Math.min(promptInput.scrollHeight, 200);
  promptInput.style.height = `${newHeight}px`;
});

async function handleFormSubmit(event) {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt || submitButton.disabled) return;

  const selectedModel = modelSelector.value;
  const provider = selectedModel.startsWith("gemini") ? "gemini" : "github";
  if (!API_KEYS[provider]) {
    alert(
      `Lỗi: Vui lòng cấu hình API Key cho ${provider.toUpperCase()} trong file script.js`
    );
    return;
  }

  addUserMessage(prompt);
  promptInput.value = "";
  promptInput.style.height = "auto";
  submitButton.disabled = true;

  conversationHistory.push({ role: "user", parts: [{ text: prompt }] });

  await streamAIResponse(selectedModel);
}

async function streamAIResponse(modelValue) {
  const aiMessageContainer = addAiMessage();
  const aiMessageContent = aiMessageContainer.querySelector(".message-content");

  try {
    if (modelValue.startsWith("gemini")) {
      await streamFromGemini(modelValue, aiMessageContent);
    } else if (modelValue.startsWith("github")) {
      await streamFromGitHub(modelValue, aiMessageContent);
    }
  } catch (error) {
    aiMessageContent.innerHTML = `<p class="text-red-500">Đã có lỗi xảy ra: ${error.message}</p>`;
  } finally {
    aiMessageContent.classList.remove("typing-cursor");
    submitButton.disabled = false;
    const fullResponseText = aiMessageContent.textContent;
    if (fullResponseText) {
      conversationHistory.push({
        role: "model",
        parts: [{ text: fullResponseText }],
      });
    }
  }
}

async function streamFromGemini(modelValue, element) {
  const modelName = GEMINI_MODELS[modelValue];
  if (!modelName) {
    throw new Error(`Model Gemini không hợp lệ: ${modelValue}`);
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${API_KEYS.gemini}&alt=sse`;
  const payload = { contents: conversationHistory };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Lỗi HTTP ${response.status}`);
  }

  await processStream(response, element, (chunk) => {
    return chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
  });
}

async function streamFromGitHub(modelValue, element) {
  const modelName = GITHUB_MODELS[modelValue];
  const apiUrl = "https://models.github.ai/inference/chat/completions";

  const githubHistory = conversationHistory.map((msg) => ({
    role: msg.role === "model" ? "assistant" : "user",
    content: msg.parts[0].text,
  }));

  const payload = {
    model: modelName,
    messages: githubHistory,
    stream: true,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEYS.github}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Lỗi HTTP ${response.status}`);
  }

  await processStream(response, element, (chunk) => {
    if (chunk === "[DONE]") return null;
    return chunk.choices?.[0]?.delta?.content || "";
  });
}

async function processStream(response, element, textExtractor) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponseText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let lineBoundary;
    while ((lineBoundary = buffer.indexOf("\n")) !== -1) {
      const line = buffer.substring(0, lineBoundary).trim();
      buffer = buffer.substring(lineBoundary + 1);

      if (line.startsWith("data: ")) {
        const dataStr = line.substring(6).trim();
        if (dataStr) {
          try {
            if (dataStr === "[DONE]") {
              if (textExtractor(dataStr) === null) return;
              continue;
            }

            const jsonData = JSON.parse(dataStr);
            const textPart = textExtractor(jsonData);

            if (textPart === null) return;

            if (textPart) {
              fullResponseText += textPart;
              element.innerHTML = marked.parse(fullResponseText);
              scrollToBottom();
            }
          } catch (e) {
            console.error("Lỗi xử lý stream chunk:", dataStr, e);
          }
        }
      }
    }
  }
}

function addUserMessage(text) {
  const messageHtml = `
        <div class="flex justify-end">
            <div class="bg-teal-600 text-white p-3 rounded-xl max-w-lg break-words">
                ${text.replace(/\n/g, "<br>")}
            </div>
        </div>
    `;
  chatHistory.insertAdjacentHTML("beforeend", messageHtml);
  scrollToBottom();
}

function addAiMessage() {
  const messageId = `ai-message-${Date.now()}`;
  const messageHtml = `
        <div class="flex items-start gap-3">
            <div class="bg-gray-200 dark:bg-gray-600 p-2.5 rounded-full flex-shrink-0">
                <i class="fas fa-robot text-teal-500 dark:text-teal-400"></i>
            </div>
            <div id="${messageId}" class="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl max-w-lg prose dark:prose-invert max-w-none">
                <div class="message-content typing-cursor"></div>
            </div>
        </div>
    `;
  chatHistory.insertAdjacentHTML("beforeend", messageHtml);
  scrollToBottom();
  return document.getElementById(messageId);
}

function scrollToBottom() {
  chatHistory.scrollTop = chatHistory.scrollHeight;
}
