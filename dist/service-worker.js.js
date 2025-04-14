console.log("NordSales service worker initialized");const c={};function s(e){const r=/https:\/\/([^.]+)\.crm\.dynamics\.com/i,t=e.match(r);return t&&t.length>1?(console.log("Organization ID detected:",t[1]),t[1]):(console.log("Could not extract organization ID from URL:",e),null)}async function d(e,r){try{const t=await chrome.tabs.get(e);if(!t||!t.url||!t.url.includes("crm.dynamics.com"))return console.log("Tab is not a Dynamics CRM tab"),!1;const o=t.url.match(/(https:\/\/[^\/]+)/);if(!o)return console.log("Could not extract base URL from tab"),!1;const a=`${o[1]}/main.aspx?etn=opportunity&pagetype=entityrecord&id=${r}`;return console.log(`Navigating tab ${e} to opportunity ${r}`),await chrome.tabs.update(e,{url:a}),!0}catch(t){return console.error("Error navigating to opportunity:",t),!1}}function p(e){chrome.tabs.get(e).then(r=>{if(r&&r.url&&r.url.includes("crm.dynamics.com")){const t=s(r.url);t&&chrome.storage.local.set({currentOrgId:t,lastOrgIdUpdated:Date.now()}),chrome.tabs.sendMessage(e,{type:"CHECK_OPPORTUNITY_ID"},o=>{if(chrome.runtime.lastError){console.log("Message error:",chrome.runtime.lastError.message),chrome.scripting.executeScript({target:{tabId:e},files:["contentScript.js"]}).catch(n=>{console.log("Error re-injecting content script:",n)});return}o&&o.opportunityId?(chrome.storage.local.set({currentOpportunityId:o.opportunityId,lastUpdated:Date.now()}),chrome.runtime.sendMessage({type:"OPPORTUNITY_DETECTED",opportunityId:o.opportunityId,organizationId:o.organizationId||t,timestamp:Date.now()}).catch(()=>{})):(chrome.storage.local.remove(["currentOpportunityId","lastUpdated"]),chrome.runtime.sendMessage({type:"OPPORTUNITY_CLEARED"}).catch(()=>{}))})}else clearInterval(c[e]),delete c[e]}).catch(()=>{clearInterval(c[e]),delete c[e]})}function m(e){c[e]&&clearInterval(c[e]),c[e]=setInterval(()=>{p(e)},2e3)}chrome.tabs.onUpdated.addListener((e,r,t)=>{if(r.status==="complete"&&t.url&&t.url.includes("crm.dynamics.com")){console.log("Dynamics CRM tab updated:",e);const o=s(t.url);o&&(console.log("Stored organization ID from tab update:",o),chrome.storage.local.set({currentOrgId:o})),chrome.scripting.executeScript({target:{tabId:e},files:["contentScript.js"]}).then(()=>{m(e)}).catch(n=>{console.error("Error injecting content script:",n)}),chrome.storage.local.get(["autoOpen"],n=>{n.autoOpen!==!1&&(chrome.action.setBadgeText({text:"!"}),chrome.action.setBadgeBackgroundColor({color:"#0078d4"}))})}else r.status==="complete"&&t.url&&!t.url.includes("crm.dynamics.com")&&chrome.action.setBadgeText({text:""})});chrome.tabs.onRemoved.addListener(e=>{c[e]&&(clearInterval(c[e]),delete c[e])});chrome.action.onClicked.addListener(e=>{chrome.sidePanel.open({tabId:e.id}).then(()=>{chrome.action.setBadgeText({text:""})}).catch(r=>{console.error("Error opening side panel:",r)})});chrome.runtime.onMessage.addListener((e,r,t)=>(console.log("Service worker received message:",e.type),e.type==="OPPORTUNITY_DETECTED"?(console.log("Received opportunity ID:",e.opportunityId),chrome.storage.local.set({currentOpportunityId:e.opportunityId,lastUpdated:e.timestamp||Date.now()}),chrome.runtime.sendMessage(e).catch(o=>{console.log("Could not forward message to side panel (probably not open)")}),t({success:!0}),!0):e.type==="OPPORTUNITY_CLEARED"?(console.log("Opportunity cleared"),chrome.storage.local.remove(["currentOpportunityId","lastUpdated"]),chrome.runtime.sendMessage(e).catch(o=>{console.log("Could not forward message to side panel")}),t({success:!0}),!0):e.type==="POPUP_OPENED"?(console.log("Side panel opened, checking for current opportunity"),chrome.tabs.query({active:!0,url:"*://*.crm.dynamics.com/*"},o=>{if(o&&o.length>0){const n=o[0].id;chrome.tabs.get(n).then(a=>{const l=s(a.url);l&&chrome.storage.local.set({currentOrgId:l}),chrome.tabs.sendMessage(n,{type:"CHECK_OPPORTUNITY_ID"},i=>{if(chrome.runtime.lastError){console.log("Error communicating with content script:",chrome.runtime.lastError.message);return}i&&i.opportunityId&&(console.log("Got opportunity ID from content script:",i.opportunityId),chrome.storage.local.set({currentOpportunityId:i.opportunityId,lastUpdated:Date.now()}),chrome.runtime.sendMessage({type:"OPPORTUNITY_DETECTED",opportunityId:i.opportunityId,organizationId:i.organizationId||l}).catch(u=>{console.log("Could not send to side panel:",u)}))})}).catch(a=>{console.log("Tab no longer exists:",a)})}}),t({success:!0}),!0):e.type==="NAVIGATE_TO_OPPORTUNITY"?(chrome.tabs.query({active:!0,currentWindow:!0},async o=>{if(o&&o.length>0){const n=o[0].id,a=await d(n,e.opportunityId);t({success:a})}else t({success:!1,error:"No active tab found"})}),!0):e.type==="SET_AUTO_OPEN"?(chrome.storage.local.set({autoOpen:e.enabled}),t({success:!0}),!0):(t({success:!1,error:"Unknown message type"}),!0)));chrome.runtime.onInstalled.addListener(()=>{console.log("NordSales extension installed/updated"),chrome.storage.local.get(["autoOpen","currentOrgId"],e=>{e.autoOpen===void 0&&chrome.storage.local.set({autoOpen:!0})})});
