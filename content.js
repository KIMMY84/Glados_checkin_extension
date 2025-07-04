// content.js - 内容脚本，注入到 GLaDOS 签到页面

console.log("GLaDOS 助手: 内容脚本已加载于", window.location.href);

// 尝试查找并点击签到按钮
function attemptCheckin() {
    console.log("GLaDOS 助手: 开始尝试查找签到按钮。");

    // 常见的签到按钮文本 (GLaDOS 页面主要是中文)
    const checkinButtonTexts = ["签到", "Check in", "Check In", "立即签到"];
    let checkinButton = null;

    // 查找所有可能的按钮元素
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]');
    
    for (const btn of buttons) {
        // 获取按钮的文本内容 (兼容不同方式获取)
        const btnText = (btn.textContent || btn.innerText || btn.value || "").trim();
        if (checkinButtonTexts.some(text => btnText.includes(text))) {
            // 这是一个初步匹配，可能需要更精确的判断
            // 例如，检查按钮是否可见且可点击
            if (btn.offsetParent !== null && !btn.disabled) { // 检查按钮是否实际可见且未被禁用
                 checkinButton = btn;
                 console.log("GLaDOS 助手: 通过文本找到可能的签到按钮:", checkinButton);
                 break;
            }
        }
    }

    // 如果通过文本找不到，可以尝试一些特定的选择器 (这些是推测，可能需要根据实际页面调整)
    if (!checkinButton) {
        const specificSelectors = [
            'button[class*="checkin"]', // 类名包含 "checkin"
            'button[id*="checkin"]',   // ID 包含 "checkin"
            '.btn-success',            // 常见的成功按钮类名
            '.btn-primary',            // 常见的主要按钮类名
            'button:contains("签到")'  // jQuery-like :contains (纯JS实现较复杂，此处为示意)
            // 以下为更具体的例子，需要根据实际情况修改
            // 'div.card-body button.btn', 
            // 'form[action*="checkin"] button[type="submit"]'
        ];
        for (const selector of specificSelectors) {
            try {
                const potentialButton = document.querySelector(selector);
                if (potentialButton && potentialButton.offsetParent !== null && !potentialButton.disabled) {
                    // 确认按钮文本是否也匹配，以增加准确性
                    const potBtnText = (potentialButton.textContent || potentialButton.innerText || potentialButton.value || "").trim();
                    if (checkinButtonTexts.some(text => potBtnText.includes(text))) {
                        checkinButton = potentialButton;
                        console.log("GLaDOS 助手: 通过特定选择器找到签到按钮:", selector, checkinButton);
                        break;
                    } else if (!potBtnText && selector.includes("checkin")) { // 如果按钮没文本但选择器很明确
                        checkinButton = potentialButton;
                        console.log("GLaDOS 助手: 通过特定选择器(无文本)找到签到按钮:", selector, checkinButton);
                        break;
                    }
                }
            } catch (e) { /*选择器无效则忽略*/ }
        }
    }
    
    // 检查页面是否已经提示“已签到”
    const alreadyCheckedInMessages = ["已签到", "已经签到过了", "You have checked in today", "今日已签"];
    const pageContent = document.body.innerText || document.body.textContent || "";
    let isAlreadyCheckedIn = alreadyCheckedInMessages.some(msg => pageContent.includes(msg));

    // 有时按钮本身会变成“已签到”状态
    if (checkinButton && (checkinButton.disabled || alreadyCheckedInMessages.some(text => (checkinButton.textContent || checkinButton.innerText || "").includes(text)))) {
        isAlreadyCheckedIn = true;
        console.log("GLaDOS 助手: 签到按钮状态或文本表明已经签到。");
    }
    
    if (isAlreadyCheckedIn) {
        console.log("GLaDOS 助手: 页面提示或按钮状态表明已经签到。");
        chrome.runtime.sendMessage({ action: "checkinResult", status: "already_checked_in" }, handleResponse);
        return;
    }

    if (checkinButton && !checkinButton.disabled) {
        console.log("GLaDOS 助手: 找到可点击的签到按钮:", checkinButton, "文本内容:", (checkinButton.textContent || checkinButton.innerText).trim());
        checkinButton.click();
        console.log("GLaDOS 助手: 已点击签到按钮。");

        // 点击后等待一段时间，检查页面是否有成功或失败的提示信息
        setTimeout(() => {
            const updatedPageContent = document.body.innerText || document.body.textContent || "";
            // 常见的成功提示信息
            const successMessages = ["签到成功", "Successfully checked in", "获得", "bonus", "已为你续期", "为你续命"];
            // 常见的失败提示信息
            const errorMessages = ["签到失败", "操作失败", "Error", "Failed", "请稍后再试"];
            
            let clickSuccess = successMessages.some(msg => updatedPageContent.toLowerCase().includes(msg.toLowerCase()));
            let clickError = errorMessages.some(msg => updatedPageContent.toLowerCase().includes(msg.toLowerCase()));

            if (clickSuccess && !clickError) { // 优先判断成功
                 console.log("GLaDOS 助手: 点击后，页面文本表明签到成功。");
                 chrome.runtime.sendMessage({ action: "checkinResult", status: "success" }, handleResponse);
            } else if (clickError) {
                console.warn("GLaDOS 助手: 点击后，页面文本表明签到失败。");
                chrome.runtime.sendMessage({ action: "checkinResult", status: "failure", reason: "点击后页面提示失败" }, handleResponse);
            } else {
                // 如果没有明确的成功或失败信息，可能需要更复杂的判断
                // 暂时认为点击了就算尝试过，但结果未知，倾向于报一个不明确的失败，促使后台记录为未完成
                console.log("GLaDOS 助手: 点击后未在页面文本中检测到明确的成功或失败信息。");
                 chrome.runtime.sendMessage({ action: "checkinResult", status: "failure", reason: "点击后结果未知" }, handleResponse);
            }
        }, 3000); // 等待3秒让页面响应，这个时间可能需要调整

    } else {
        if (!checkinButton) {
            console.warn("GLaDOS 助手: 未能在页面上找到签到按钮。");
        } else if (checkinButton.disabled) {
            console.warn("GLaDOS 助手: 找到签到按钮，但按钮被禁用。");
        }
        chrome.runtime.sendMessage({ action: "checkinResult", status: "failure", reason: "签到按钮未找到或被禁用" }, handleResponse);
    }
}

function handleResponse(response) {
    if (chrome.runtime.lastError) {
        console.error("GLaDOS 助手: 发送消息到后台脚本时出错:", chrome.runtime.lastError.message);
    } else {
        console.log("GLaDOS 助手: 消息已发送到后台脚本，响应:", response);
    }
}

// 确保DOM加载完成后执行脚本
// `run_at: document_idle` 已经有所帮助，但可以再加一层保险
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(attemptCheckin, 500)); // DOM加载后稍作等待
} else {
    // DOMContentLoaded 事件已触发
    setTimeout(attemptCheckin, 500); // 稍作等待，以防页面有后续JS加载内容
}
