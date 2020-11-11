'use strict';

const browserAction = {};

browserAction.show = function(tab, popupData) {
    if (!popupData) {
        popupData = page.popupData;
    }

    page.popupData = popupData;

    browserAction.setBadge(popupData.iconType)

    if (popupData.popup) {
        browser.browserAction.setPopup({
            tabId: tab.id,
            popup: `popups/${popupData.popup}.html`
        });
    }
};

browserAction.showDefault = async function(tab) {
    const popupData = {
        iconType: 'normal',
        popup: 'popup'
    };

    const response = await keepass.isConfigured().catch((err) => {
        console.log('Error: Cannot show default popup: ' + err);
    });

    if (!response && !keepass.isKeePassXCAvailable) {
        popupData.iconType = 'cross';
    } else if (keepass.isKeePassXCAvailable && keepass.isDatabaseClosed) {
        popupData.iconType = 'locked';
    }

    if (page.tabs[tab.id] && page.tabs[tab.id].loginList.length > 0) {
        popupData.iconType = 'questionmark';
        popupData.popup = 'popup_login';
    }

    browserAction.show(tab, popupData);
};

browserAction.updateIcon = async function(tab, iconType) {
    if (!tab) {
        const tabs = await browser.tabs.query({ 'active': true, 'currentWindow': true });
        if (tabs.length === 0) {
            return;
        }

        tab = tabs[0];
    }

    browserAction.setBadge(popupData.iconType)
};

browserAction.setBadge = function(iconType) {
    let map = { 'cross': { text: '!', backgroundColor: '#FFCC00' }, 'dark': { text: '' }, 'locked': { text: '🔒︎', backgroundColor: '#FC7A57' }, 'normal': {text: ''}, 'questionmark': {text: '?', backgroundColor: '#9DD9D2' } };
    let badge;
    if(iconType in map) {
        badge = map[iconType];
    } else {
        badge = { text: '', backgroundColor: '' };
    }

    if (keepass.keePassXCUpdateAvailable()) {
        badge.text += '+';
    }

    browser.browserAction.setBadgeText({
        text: badge.text
    });
    browser.browserAction.setBadgeBackgroundColor({
        color: badge.backgroundColor
    });
}

browserAction.ignoreSite = async function(url) {
    await browser.windows.getCurrent();

    // Get current active window
    const tabs = await browser.tabs.query({ 'active': true, 'currentWindow': true });
    const tab = tabs[0];

    // Send the message to the current tab's content script
    await browser.runtime.getBackgroundPage();
    browser.tabs.sendMessage(tab.id, {
        action: 'ignore_site',
        args: [ url ]
    });
};
