// Thiết lập Tailwind Dark Mode
tailwind.config = {
  darkMode: "class",
};

// --- DOM ELEMENTS ---
const themeToggleButton = document.getElementById("theme-toggle");
const themeIconLight = document.getElementById("theme-icon-light");
const themeIconDark = document.getElementById("theme-icon-dark");
const themeText = document.getElementById("theme-text");

const promptForm = document.getElementById("prompt-form");
const promptInput = document.getElementById("prompt-input");
const submitButton = document.getElementById("submit-button");
const chatContainer = document.getElementById("chat-container");
const chatHistory = document.getElementById("chat-history");
const modelSelector = document.getElementById("model-selector");
const newChatButton = document.getElementById("new-chat-btn");
const chatHistoryList = document.getElementById("chat-history-list");

// --- STATE MANAGEMENT ---
let allConversations = {};
let currentConversationId = null;

// --- EVENT LISTENERS ---

// Tải mọi thứ khi trang được load
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadConversationsFromStorage();
  renderHistorySidebar();
  if (currentConversationId && allConversations[currentConversationId]) {
    renderConversation(currentConversationId);
  } else {
    startNewChat();
  }
});

// Chuyển đổi theme Sáng/Tối
themeToggleButton.addEventListener("click", () => {
  const isDarkMode = document.documentElement.classList.contains("dark");
  const newTheme = isDarkMode ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("theme", newTheme);
});

// Bắt đầu cuộc trò chuyện mới
newChatButton.addEventListener("click", startNewChat);

// Gửi form
promptForm.addEventListener("submit", handleFormSubmit);

// Tự động thay đổi chiều cao của textarea
promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  const newHeight = Math.min(promptInput.scrollHeight, 200);
  promptInput.style.height = `${newHeight}px`;
});

// Gửi bằng phím Enter (không gửi khi nhấn Shift + Enter)
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    promptForm.requestSubmit();
  }
});

// --- THEME FUNCTIONS ---
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark:bg-[#343541]");
    document.body.classList.remove("bg-gray-100");
    themeIconLight.classList.add("hidden");
    themeIconDark.classList.remove("hidden");
    themeText.textContent = "Light mode";
  } else {
    document.documentElement.classList.remove("dark");
    document.body.classList.add("bg-gray-100");
    document.body.classList.remove("dark:bg-[#343541]");
    themeIconLight.classList.remove("hidden");
    themeIconDark.classList.add("hidden");
    themeText.textContent = "Dark mode";
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme") || "dark"; // Mặc định là dark
  applyTheme(savedTheme);
}

// --- CHAT HISTORY & STORAGE FUNCTIONS ---

function loadConversationsFromStorage() {
  const storedData = localStorage.getItem("chatConversations");
  if (storedData) {
    const parsedData = JSON.parse(storedData);
    allConversations = parsedData.conversations || {};
    currentConversationId = parsedData.currentId || null;
  } else {
    allConversations = {};
    currentConversationId = null;
  }
}

function saveConversationsToStorage() {
  const dataToStore = {
    conversations: allConversations,
    currentId: currentConversationId,
  };
  localStorage.setItem("chatConversations", JSON.stringify(dataToStore));
}

function getConversationTitle(conversation) {
  if (conversation && conversation.length > 0) {
    const firstUserMessage = conversation.find((msg) => msg.role === "user");
    if (firstUserMessage) {
      const text = firstUserMessage.parts[0].text;
      return text.substring(0, 35) + (text.length > 35 ? "..." : "");
    }
  }
  return "New Chat";
}

function renderHistorySidebar() {
  chatHistoryList.innerHTML = "";
  const sortedIds = Object.keys(allConversations).sort((a, b) => b - a); // Sắp xếp mới nhất lên đầu

  sortedIds.forEach((id) => {
    const conversation = allConversations[id];
    if (!conversation || conversation.length === 0) return; // Không hiển thị chat rỗng

    const title = getConversationTitle(conversation);
    const historyItem = document.createElement("button");
    historyItem.className = `w-full text-left p-3 text-sm rounded-lg truncate transition-colors ${
      id === currentConversationId
        ? "bg-gray-700 text-white"
        : "hover:bg-gray-800 text-gray-300"
    }`;
    historyItem.textContent = title;
    historyItem.dataset.id = id;
    historyItem.addEventListener("click", () => switchConversation(id));
    chatHistoryList.appendChild(historyItem);
  });
}

function switchConversation(id) {
  if (id === currentConversationId) return;
  currentConversationId = id;
  renderConversation(id);
  renderHistorySidebar(); // Cập nhật lại highlight
  saveConversationsToStorage();
}

function startNewChat() {
  currentConversationId = Date.now().toString();
  allConversations[currentConversationId] = [];
  chatHistory.innerHTML = "";
  addWelcomeMessage();
  promptInput.value = "";
  promptInput.style.height = "auto";
  submitButton.disabled = false;
  renderHistorySidebar();
  saveConversationsToStorage();
}

function renderConversation(id) {
  const conversation = allConversations[id];
  chatHistory.innerHTML = "";

  if (!conversation || conversation.length === 0) {
    addWelcomeMessage();
    return;
  }

  conversation.forEach((message) => {
    const content = message.parts[0].text;
    addMessageToUI(message.role, content, false);
  });
  scrollToBottom();
}

// --- MESSAGE HANDLING FUNCTIONS ---

async function handleFormSubmit(event) {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt || submitButton.disabled) return;

  // Nếu cuộc trò chuyện hiện tại trống, hãy tạo một cuộc trò chuyện mới
  if (allConversations[currentConversationId].length === 0) {
    // Không cần làm gì ở đây, vì addMessage đã xử lý việc lưu
  }

  addUserMessage(prompt, true); // true = lưu vào state
  promptInput.value = "";
  promptInput.style.height = "auto";
  submitButton.disabled = true;

  // Tạo placeholder cho tin nhắn AI và lấy element của nó
  const aiMessageContainer = addAiMessage("", true);
  const aiMessageContent = aiMessageContainer.querySelector(".message-content");

  // Lấy lịch sử để gửi đi (không bao gồm placeholder rỗng của AI)
  const historyForApi = allConversations[currentConversationId].slice(0, -1);
  const selectedModel = modelSelector.value;

  // Gọi hàm xử lý stream đã được cập nhật
  await streamAIResponse(selectedModel, historyForApi, aiMessageContent);
}

/**
 * [SỬA ĐỔI] Hàm này đã được viết lại hoàn toàn để xử lý định dạng stream đã được chuẩn hóa từ server.
 */
async function streamAIResponse(modelValue, history, aiMessageContent) {
  const backendApiUrl =
    "https://llm-chat-streaming-basic-be.onrender.com/api/chat";
  let fullResponseText = "";

  try {
    const payload = { model: modelValue, history: history };

    const response = await fetch(backendApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Lỗi từ server: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Server gửi các sự kiện được phân tách bằng "\n\n"
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.substring(6).trim();
          if (!dataStr) continue;

          try {
            const jsonData = JSON.parse(dataStr);
            if (jsonData.error) throw new Error(jsonData.error);

            // **LOGIC QUAN TRỌNG NHẤT**
            // Chỉ cần lấy `jsonData.text`, bất kể model là gì.
            const textPart = jsonData.text || "";
            if (textPart) {
              fullResponseText += textPart;
              // Sử dụng marked.js để render Markdown trực tiếp
              aiMessageContent.innerHTML = marked.parse(
                fullResponseText + '<span class="typing-cursor"></span>'
              );
              scrollToBottom();
            }
          } catch (e) {
            console.error("Lỗi xử lý stream chunk:", dataStr, e);
          }
        }
      }
    }
  } catch (error) {
    aiMessageContent.innerHTML = `<p class="text-red-500">Đã có lỗi xảy ra: ${error.message}</p>`;
  } finally {
    // Hoàn tất và dọn dẹp
    aiMessageContent.innerHTML = marked.parse(fullResponseText); // Xóa con trỏ nhấp nháy

    // Cập nhật tin nhắn cuối cùng trong state với nội dung đầy đủ
    if (fullResponseText) {
      const currentConv = allConversations[currentConversationId];
      if (currentConv && currentConv.length > 0) {
        const lastMessage = currentConv[currentConv.length - 1];
        if (lastMessage && lastMessage.role === "model") {
          lastMessage.parts[0].text = fullResponseText;
        }
      }
      saveConversationsToStorage();
      renderHistorySidebar(); // Cập nhật sidebar nếu là tin nhắn đầu tiên
    }

    submitButton.disabled = false;
    scrollToBottom();
  }
}

function addMessageToUI(role, content, shouldParseMarkdown = true) {
  const wrapper = document.createElement("div");
  const isUser = role === "user";

  wrapper.className = `flex items-start gap-4 p-4 md:p-6 ${
    isUser ? "justify-end" : ""
  }`;

  const messageBg = isUser
    ? "bg-teal-600 text-white"
    : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200";
  const avatarIcon = isUser ? "fa-user" : "fa-robot";
  const avatarBg = isUser ? "bg-teal-600" : "dark:bg-gray-800 bg-gray-200";
  const avatarText = isUser ? "text-white" : "text-teal-500";

  // Xử lý nội dung: parse markdown cho AI, escape HTML cho người dùng
  let processedContent;
  if (isUser) {
    processedContent = content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  } else {
    processedContent = shouldParseMarkdown ? marked.parse(content) : content;
  }

  const messageHtml = `
      ${
        !isUser
          ? `<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${avatarBg}"><i class="fas ${avatarIcon} ${avatarText}"></i></div>`
          : ""
      }
      <div class="message-bubble p-4 rounded-2xl max-w-2xl prose dark:prose-invert max-w-none ${messageBg}">
          <div class="message-content">${processedContent}</div>
      </div>
      ${
        isUser
          ? `<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${avatarBg}"><i class="fas ${avatarIcon} ${avatarText}"></i></div>`
          : ""
      }
    `;

  wrapper.innerHTML = messageHtml;
  chatHistory.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function addUserMessage(text, shouldSave = true) {
  if (shouldSave) {
    allConversations[currentConversationId].push({
      role: "user",
      parts: [{ text }],
    });
    saveConversationsToStorage();
    // Cập nhật sidebar nếu đây là tin nhắn đầu tiên
    if (allConversations[currentConversationId].length === 1) {
      renderHistorySidebar();
    }
  }
  addMessageToUI("user", text);
}

function addAiMessage(text = "", shouldSavePlaceholder = false) {
  if (shouldSavePlaceholder) {
    // Thêm một placeholder vào state
    allConversations[currentConversationId].push({
      role: "model",
      parts: [{ text: "" }], // Nội dung ban đầu là rỗng
    });
    saveConversationsToStorage();
  }

  const content = text
    ? marked.parse(text)
    : '<span class="typing-cursor"></span>';
  return addMessageToUI("model", content, false); // `false` vì nội dung đã được xử lý
}

function addWelcomeMessage() {
  chatHistory.innerHTML = `
        <div class="text-center py-20">
            <div class="inline-block bg-white dark:bg-gray-800 p-4 rounded-full shadow-lg">
                <i class="fas fa-robot text-4xl text-teal-500"></i>
            </div>
            <h2 class="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-200">
                Làm thế nào tôi có thể giúp bạn hôm nay?
            </h2>
        </div>
    `;
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}
