const i={},u={};function m(t){const r=/https:\/\/([^.]+)\.crm\.dynamics\.com/i,e=t.match(r);return e&&e.length>1?e[1]:null}async function d(t,r){try{const e=await chrome.tabs.get(t);if(!e||!e.url||!e.url.includes("crm.dynamics.com"))return!1;const o=e.url.match(/(https:\/\/[^\/]+)/);if(!o)return console.warn("Could not extract base URL from tab"),!1;const c=`${o[1]}/main.aspx?etn=opportunity&pagetype=entityrecord&id=${r}`;return await chrome.tabs.update(t,{url:c}),setTimeout(async()=>{await l(t),chrome.tabs.sendMessage(t,{type:"CHECK_OPPORTUNITY_ID"},a=>{if(chrome.runtime.lastError){console.warn("CHECK_OPPORTUNITY_ID error:",chrome.runtime.lastError.message);return}a&&a.opportunityId&&(chrome.storage.local.set({currentOpportunityId:a.opportunityId,lastUpdated:Date.now()}),chrome.runtime.sendMessage({type:"OPPORTUNITY_DETECTED",opportunityId:a.opportunityId}).catch(()=>{}))})},1500),setTimeout(()=>{p(t)},2e3),!0}catch(e){return console.warn("Error navigating to opportunity:",e),!1}}async function l(t){try{const r=await chrome.tabs.get(t);return!r||!r.url||!r.url.includes("crm.dynamics.com")?!1:u[t]?!0:(await chrome.scripting.executeScript({target:{tabId:t},files:["contentScript.js"]}),u[t]=!0,new Promise(e=>setTimeout(e,500)))}catch(r){return console.warn("Error ensuring content script:",r),!1}}async function p(t){try{const r=await chrome.tabs.get(t);if(!r||!r.url||!r.url.includes("crm.dynamics.com")){clearInterval(i[t]),delete i[t],delete u[t];return}const e=m(r.url);e&&chrome.storage.local.set({currentOrgId:e,lastOrgIdUpdated:Date.now()}),await l(t);const n=await(()=>new Promise(c=>{chrome.tabs.sendMessage(t,{type:"CHECK_OPPORTUNITY_ID"},a=>{if(chrome.runtime.lastError){u[t]=!1,c(null);return}c(a)}),setTimeout(()=>c(null),1e3)}))();n&&n.opportunityId?(chrome.storage.local.set({currentOpportunityId:n.opportunityId,lastUpdated:Date.now()}),chrome.runtime.sendMessage({type:"OPPORTUNITY_DETECTED",opportunityId:n.opportunityId,organizationId:n.organizationId||e,timestamp:Date.now()}).catch(()=>{})):(chrome.storage.local.remove(["currentOpportunityId","lastUpdated"]),chrome.runtime.sendMessage({type:"OPPORTUNITY_CLEARED"}).catch(()=>{}))}catch{clearInterval(i[t]),delete i[t],delete u[t]}}function h(t){i[t]&&clearInterval(i[t]),i[t]=setInterval(()=>{p(t)},2e3)}chrome.tabs.onUpdated.addListener((t,r,e)=>{var o;if(r.status==="complete"){const n=(o=e.url)==null?void 0:o.includes("crm.dynamics.com");if(chrome.runtime.sendMessage({type:"TAB_CONTEXT_UPDATE",isCRM:n}).catch(()=>{}),n){const c=m(e.url);c&&chrome.storage.local.set({currentOrgId:c}),u[t]=!1,l(t).then(()=>{h(t)}).catch(a=>{console.error("Error injecting content script:",a)}),chrome.storage.local.get(["autoOpen"],a=>{a.autoOpen!==!1&&(chrome.action.setBadgeText({text:"!"}),chrome.action.setBadgeBackgroundColor({color:"#0078d4"}))})}else chrome.action.setBadgeText({text:""})}});chrome.tabs.onRemoved.addListener(t=>{i[t]&&(clearInterval(i[t]),delete i[t],delete u[t])});chrome.action.onClicked.addListener(t=>{chrome.sidePanel.open({tabId:t.id}).then(()=>{chrome.action.setBadgeText({text:""})}).catch(r=>{console.error("Error opening side panel:",r)})});chrome.runtime.onMessage.addListener((t,r,e)=>t.type==="OPPORTUNITY_DETECTED"?(chrome.storage.local.set({currentOpportunityId:t.opportunityId,lastUpdated:t.timestamp||Date.now()}),chrome.runtime.sendMessage(t).catch(o=>{}),e({success:!0}),!0):t.type==="OPPORTUNITY_CLEARED"?globalThis.lastClearedTimestamp&&Date.now()-globalThis.lastClearedTimestamp<500?void 0:(globalThis.lastClearedTimestamp=Date.now(),chrome.runtime.sendMessage(t).catch(o=>{}),e({success:!0}),!0):t.type==="POPUP_OPENED"?(chrome.tabs.query({active:!0,url:"*://*.crm.dynamics.com/*"},o=>{if(o&&o.length>0){const n=o[0].id;chrome.tabs.get(n).then(c=>{const a=m(c.url);a&&chrome.storage.local.set({currentOrgId:a}),u[n]=!1,l(n).then(()=>{chrome.tabs.sendMessage(n,{type:"CHECK_OPPORTUNITY_ID"},s=>{if(chrome.runtime.lastError){console.warn("Error communicating with content script:",chrome.runtime.lastError.message);return}s&&s.opportunityId&&(chrome.storage.local.set({currentOpportunityId:s.opportunityId,lastUpdated:Date.now()}),chrome.runtime.sendMessage({type:"OPPORTUNITY_DETECTED",opportunityId:s.opportunityId,organizationId:s.organizationId||a}).catch(g=>{}))})}).catch(s=>{console.error("Error injecting content script from POPUP_OPENED:",s)})}).catch(c=>{console.warn("Tab no longer exists:",c)})}}),e({success:!0}),!0):t.type==="NAVIGATE_TO_OPPORTUNITY"?(chrome.tabs.query({active:!0,currentWindow:!0},async o=>{if(o&&o.length>0){const n=o[0].id,c=await d(n,t.opportunityId);e({success:c})}else e({success:!1,error:"No active tab found"})}),!0):t.type==="SET_AUTO_OPEN"?(chrome.storage.local.set({autoOpen:t.enabled}),e({success:!0}),!0):(e({success:!1,error:"Unknown message type"}),!0));chrome.runtime.onInstalled.addListener(()=>{chrome.storage.local.get(["autoOpen","currentOrgId"],t=>{t.autoOpen===void 0&&chrome.storage.local.set({autoOpen:!0})})});
