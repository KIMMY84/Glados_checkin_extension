// background.js - 后台脚本

// 获取 YYYY-MM-DD 格式的日期字符串
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // 月份从0开始
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const checkinUrl = "https://glados.rocks/console/checkin";
const ALARM_NAME = "gladosDailyCheckinAlarm"; // 定时器名称

// 执行签到检查和操作的核心逻辑
async function performCheckinLogic() {
  console.log("GLaDOS 助手: 开始执行签到检查逻辑。");
  try {
    // 从存储中获取上次签到日期和状态
    const result = await chrome.storage.local.get(['lastCheckinDate', 'checkinStatus']);
    const lastCheckinDate = result.lastCheckinDate;
    const todayDateString = getTodayDateString();

    console.log(`GLaDOS 助手: 上次签到日期: ${lastCheckinDate}, 状态: ${result.checkinStatus}。今天是: ${todayDateString}`);

    // 如果今天已经成功签到，则不执行任何操作
    if (lastCheckinDate === todayDateString && result.checkinStatus === 'success') {
      console.log("GLaDOS 助手: 今天已经成功签到过了。");
      return;
    }

    console.log("GLaDOS 助手: 今天尚未签到或上次尝试未成功。准备打开签到页面。");
    
    // 检查签到页面是否已打开，避免重复打开
    chrome.tabs.query({ url: checkinUrl }, (existingTabs) => {
      if (chrome.runtime.lastError) {
        console.error("GLaDOS 助手: 查询标签页时出错:", chrome.runtime.lastError.message);
        return;
      }

      if (existingTabs && existingTabs.length > 0) {
        console.log("GLaDOS 助手: 签到页面已打开，将激活并刷新该页面。", existingTabs[0]);
        chrome.tabs.update(existingTabs[0].id, { active: true }, () => {
          if (chrome.runtime.lastError) {
            console.error("GLaDOS 助手: 激活标签页时出错:", chrome.runtime.lastError.message);
          } else {
            chrome.tabs.reload(existingTabs[0].id, () => {
              if (chrome.runtime.lastError) {
                console.error("GLaDOS 助手: 刷新标签页时出错:", chrome.runtime.lastError.message);
              } else {
                console.log("GLaDOS 助手: 签到页面已刷新，内容脚本将尝试执行。");
              }
            });
          }
        });
      } else {
        // 打开新的签到页面
        chrome.tabs.create({ url: checkinUrl, active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error("GLaDOS 助手: 打开新标签页时出错:", chrome.runtime.lastError.message);
            return;
          }
          if (tab) {
            console.log(`GLaDOS 助手: 已打开新的签到标签页 (ID: ${tab.id})。内容脚本将尝试执行。`);
          } else {
            console.error("GLaDOS 助手: 打开新标签页失败，未返回标签页对象。");
          }
        });
      }
    });

  } catch (error) {
    console.error("GLaDOS 助手: 执行签到逻辑时发生错误:", error);
  }
}

// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("GLaDOS 助手: 后台脚本收到消息:", request);
  if (request.action === "checkinResult") {
    const todayDateString = getTodayDateString();
    let responseStatus = "unknown_message_status";

    if (request.status === "success" || request.status === "already_checked_in") {
      chrome.storage.local.set({ lastCheckinDate: todayDateString, checkinStatus: 'success' }, () => {
        if (chrome.runtime.lastError) {
          console.error("GLaDOS 助手: 更新存储 (成功/已签到) 时出错:", chrome.runtime.lastError.message);
        } else {
          console.log(`GLaDOS 助手: 签到状态报告为 '${request.status}'。已更新存储中的日期和状态为成功。`);
        }
        responseStatus = "success_storage_updated";
      });
    } else if (request.status === "failure") {
      chrome.storage.local.set({ lastCheckinDate: todayDateString, checkinStatus: 'failure' }, () => {
         if (chrome.runtime.lastError) {
          console.error("GLaDOS 助手: 更新存储 (失败) 时出错:", chrome.runtime.lastError.message);
        } else {
          console.warn(`GLaDOS 助手: 签到状态报告为失败。原因: ${request.reason || '未提供'}。已更新存储中的状态为失败。`);
        }
        responseStatus = "failure_storage_updated";
      });
    } else {
      console.warn("GLaDOS 助手: 收到未知的签到结果状态:", request.status);
    }
    sendResponse({ status: responseStatus, message: "后台已处理签到结果。" });
    return true; // 表示将异步发送响应
  }
});

// 扩展安装或更新时设置定时器
chrome.runtime.onInstalled.addListener((details) => {
  console.log("GLaDOS 助手: 扩展已安装/更新。原因:", details.reason);
  console.log("GLaDOS 助手: 正在设置每日检查的定时器。");
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,      // 1分钟后首次执行
    periodInMinutes: 60 * 24 // 每24小时执行一次 (1440 分钟)
  });
  // 安装或更新后也立即执行一次检查
  performCheckinLogic();
});

// 监听定时器事件
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log("GLaDOS 助手: 每日定时器触发。执行签到检查。");
    performCheckinLogic();
  }
});

// 浏览器启动时执行检查
chrome.runtime.onStartup.addListener(() => {
  console.log("GLaDOS 助手: 检测到浏览器启动。执行签到检查。");
  // 定时器也会在启动后不久触发，但为了更及时，这里也调用一次。
  // performCheckinLogic 中的逻辑会防止重复操作。
  performCheckinLogic();
});

console.log("GLaDOS 助手: 后台服务脚本已启动。");
