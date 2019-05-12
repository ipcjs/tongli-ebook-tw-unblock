function getCurrentTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs[0])
        })
    })
}

function copyText(textarea, text) {
    if (text != undefined) {
        textarea.value = text
    }
    textarea.select()
    try {
        return document.execCommand('copy')
    } catch (e) {
        console.error('复制文本出错', e)
    }
    return false
}

function obtainAuthInContentScript() {
    function obtainAuthInPage() {
        console.log('obtainAuthInPage()', window.$, window.domain)
        window.postMessage({
            type: 'teu:auth-info',
            content: {
                auth: window.$ && window.$.ajaxSettings.headers.Authorization,
                domain: window.domain
            }
        }, "*")
    }

    console.log('obtainAuthInContentScript()', window.$, window.domain)
    window.addEventListener('message', (event) => {
        if (typeof event.data.type === 'string' && event.data.type.startsWith('teu:')) {
            chrome.runtime.sendMessage(event.data)
        }
    }, { once: true })
    let $script = document.createElement('script')
    $script.innerHTML = `${obtainAuthInPage.toString()}; ${obtainAuthInPage.name}();`
    document.body.appendChild($script)
}

const TAB_MSG_LISTENERS = new Map()
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.tab) {
        let listener = TAB_MSG_LISTENERS.get(sender.tab.id)
        listener && listener(msg, sender, sendResponse)
    }
})

function getAuth(tabId) {
    return new Promise((resolve, reject) => {
        TAB_MSG_LISTENERS.set(tabId, (msg, sender, sendResponse) => {
            if (msg.type === 'teu:auth-info') {
                resolve(msg.content)
                TAB_MSG_LISTENERS.delete(tabId)
            }
        })
        chrome.tabs.executeScript(tabId, { code: `${obtainAuthInContentScript.toString()}; ${obtainAuthInContentScript.name}();` })
    })
}

async function main() {
    let $msg = document.getElementById('msg')
    let $output = document.getElementById('output')
    let $result = document.getElementById('result')
    $result.style.display = 'none'
    let tab = await getCurrentTab()
    let url = new URL(tab.url)
    if (url.host === 'ebook.tongli.com.tw' && url.searchParams.has('bookID')) {
        $msg.innerText = '获取Authorization中...'
        let { auth, domain } = await getAuth(tab.id)
        if (auth && domain) {
            $msg.innerText = '获取下载地址中...'
            let result = await fetch(`${domain}/Comic/${url.searchParams.get('bookID')}`, { headers: { Authorization: auth } })
                .then(r => r.json())
                .catch(e => {
                    $msg.innerText = '获取下载地址失败, 请刷新页面重试'
                })
            if (result) {
                console.log('result', result)
                $msg.innerHTML = '结果:'
                $result.style.display = ''

                Array.from($result.querySelectorAll('input[type=button]')).forEach(it => {
                    it.addEventListener('click', (event) => {
                        switch (event.target.name) {
                            case 'copy-curl':
                                copyText($output, result.Pages.map(it => `curl '${it.ImageURL}' -H 'Authorization: ${auth}' -o ${it.PageNumber}.jpg`).join('\n') + '\n')
                                break
                            case 'copy-yaaw':
                                copyText($output, `Authorization: ${auth}\n\n\n${result.Pages.map(it => `${it.ImageURL} --out=${it.PageNumber}.jpg`).join('\n')}`)
                                break
                            case 'copy':
                                copyText($output)
                                break
                            case 'download':
                                result.Pages.forEach(page => {
                                    chrome.downloads.download({
                                        url: page.ImageURL,
                                        filename: `${result.Title}/${page.PageNumber}.jpg`,
                                        headers: [
                                            { name: 'Authorization', value: auth }
                                        ]
                                    })
                                })
                                break
                        }
                    })
                })

                $output.value = result.Pages.map(it => it.ImageURL).join('\n')
            }
        } else {
            $msg.innerText = '获取Authorization失败, 请重试'
        }
    } else {
        $msg.innerText = '未检测到漫画下载地址'
    }
}

main()