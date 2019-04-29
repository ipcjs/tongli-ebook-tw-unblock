'use strict'

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        details.requestHeaders.push({
            name: 'X-Forwarded-For',
            value: '59.125.39.5',
        })
        return { requestHeaders: details.requestHeaders }
    },
    { urls: ["*://ebook.tongli.com.tw/*"] },
    ["blocking", 'requestHeaders']
)