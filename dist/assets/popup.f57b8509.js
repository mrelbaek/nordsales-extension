import{r as c,a as t,j as s}from"./jsx-runtime.91c62a54.js";function p(){const[e,n]=c.exports.useState(0);return c.exports.useEffect(()=>{chrome.storage.local.get(["count"],o=>{o.count!==void 0&&n(o.count)})},[]),t("div",{className:"popup",children:[s("h1",{children:"NordSales Extension"}),t("div",{className:"card",children:[t("button",{onClick:()=>{const o=e+1;n(o),chrome.storage.local.set({count:o})},children:["Count is ",e]}),t("p",{children:["Edit ",s("code",{children:"src/pages/popup/Popup.jsx"})," and save to test"]})]})]})}export{p as P};
