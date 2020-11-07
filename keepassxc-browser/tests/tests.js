'use strict';

const Tests = {
    GLOBAL: '#global-results',
    KEEPASSXCBROWSER: '#keepassxcbrowser-results',
    TOTP: '#totpfield-results'
};

function createResult(card, res, text) {
    const icon = kpxcUI.createElement('i', res ? 'fa fa-check' : 'fa fa-close');
    const span = kpxcUI.createElement('span', '', '', text);
    const br = document.createElement('br');

    document.querySelector(card).appendMultiple(icon, span, br);
}

function assert(func, expected, card, testName) {
    if (func === expected) {
        createResult(card, true, `Test passed: ${testName}`);
        return;
    }

    createResult(card, false, `Test failed: ${testName}. Result is: ${func}`);
}

function assertRegex(func, expected, card, testName) {
    if ((func === null && expected === false)
        || (func && (func.length > 0) === expected)) {
        createResult(card, true, `Test passed: ${testName}`);
        return;
    }

    createResult(card, false, `Test failed: ${testName}. Result is: ${func}`);
}

async function assertInputFields(localFile, expectedFieldCount, actionElementId) {
    return new Promise((resolve) => {
        const iframe = document.getElementById('testFile');
        iframe.src = localFile;

        const iframeLoaded = function() {
            const frameContent = iframe.contentWindow.document.getElementsByTagName('body')[0];

            // Load prototypes to iframe. This doesn't work automatically from ui.js
            iframe.contentWindow.Element.prototype.getLowerCaseAttribute = function(attr) {
                return this.getAttribute(attr) ? this.getAttribute(attr).toLowerCase() : undefined;
            };

            // An user interaction is required before testing
            if (actionElementId) {
                const actionElement = frameContent.querySelector(actionElementId);
                if (actionElement) {
                    actionElement.click();
                }
            }

            const inputs = kpxcObserverHelper.getInputs(frameContent);
            assert(inputs.length, expectedFieldCount, Tests.KEEPASSXCBROWSER, `getInputs() for ${localFile} with ${expectedFieldCount} fields`);
            iframe.removeEventListener('load', iframeLoaded);
            resolve();
        };

        // Wait for iframe to load
        iframe.addEventListener('load', iframeLoaded);
    });
}

async function assertTOTPField(classStr, properties, testName, expectedResult) {
    const input = kpxcUI.createElement('input', classStr, properties);
    document.body.appendChild(input);

    const isAccepted = kpxcTOTPIcons.isAcceptedTOTPField(input);
    const isValid = kpxcTOTPIcons.isValid(input);

    document.body.removeChild(input);
    assert(isAccepted && isValid, expectedResult, Tests.TOTP, testName);
}


/*
 * Actual tests
 * ===================
 */

// Tests for global.js
async function testGlobal() {
    const testCard = Tests.GLOBAL;

    // General
    assert(trimURL('https://test.com/path_to_somwhere?login=username'), 'https://test.com/path_to_somwhere', testCard, 'trimURL()');
    assertRegex(slashNeededForUrl('https://test.com'), true, testCard, 'slashNeededForUrl()');
    assertRegex(slashNeededForUrl('https://test.com/'), false, testCard, 'slashNeededForUrl()');

    // URL matching (URL in Site Preferences, page URL, expected result).
    // Consider using slighly different URL's for the tests cases.
    const matches = [
        [ 'https://example.com/*', 'https://example.com/login_page', true ],
        [ 'https://example.com/*', 'https://example2.com/login_page', false ],
        [ 'https://example.com/*', 'https://subdomain.example.com/login_page', false ],
        [ 'https://*.example.com/*', 'https://example.com/login_page', true ],
        [ 'https://*.example.com/*', 'https://test.example.com/login_page', true ],
        [ 'https://test.example.com/*', 'https://subdomain.example.com/login_page', false ],
        [ 'https://test.example.com/page/*', 'https://test.example.com/page/login_page', true ],
        [ 'https://test.example.com/page/another_page/*', 'https://test.example.com/page/login', false ],
        [ 'https://test.example.com/path/another/a/', 'https://test.example.com/path/another/a/', true ],
        [ 'https://test.example.com/path/another/a/', 'https://test.example.com/path/another/b/', false ],
    ];

    for (const m of matches) {
        assertRegex(siteMatch(m[0], m[1]), m[2], testCard, `siteMatch() for ${m[1]}`);
    }
}

// Tests for keepassxc-browser.js
async function testKeePassXCBrowser() {
    // Local filename, expected fields, action element ID (a button to be clicked)
    const localFiles = [
        [ 'html/basic1.html', 2 ], // Username/passwd fields
        [ 'html/basic2.html', 1 ], // Only username field
        [ 'html/basic3.html', 1 ], // Only password field
        [ 'html/basic4.html', 3 ], // Username/passwd/TOTP fields
        [ 'html/div1.html', 2, '#toggle' ], // Fields are behind a button that must be pressed
        [ 'html/div2.html', 2, '#toggle' ], // Fields are behind a button that must be pressed behind a JavaScript
        [ 'html/div3.html', 2, '#toggle' ], // Fields are behind a button that must be pressed
        [ 'html/div4.html', 2, '#toggle' ], // Fields are behind a button that must be pressed
        [ 'html/hidden_fields1.html', 0 ], // Two hidden fields
        [ 'html/hidden_fields2.html', 1 ], // Two hidden fields with one visible
    ];

    for (const file of localFiles) {
        await assertInputFields(file[0], file[1], file[2]);
    }

    document.getElementById('testFile').hidden = true;
}

// Tests for totp-field.js
async function testTotpFields() {
    const totpFields = [
        [ '', { id: 'otp_field', name: 'otp', type: 'text', maxLength: '8' }, 'Generic 2FA field', true ],
        [ '', { id: '2fa', type: 'text', maxLength: '6' }, 'Generic 2FA field', true ],
        [ '', { id: '2fa', type: 'text', maxLength: '4' }, 'Ignore if field maxLength too small', false ],
        [ '', { id: '2fa', type: 'text', maxLength: '12' }, 'Ignore if field maxLength too long', false ],
        [ '', { id: 'username', type: 'text', }, 'Ignore a generic input field', false ],
        [ '', { type: 'password', }, 'Ignore a password input field', false ],
        [ // Protonmail
            'TwoFA-input ng-empty ng-invalid ng-invalid-required ng-valid-minlength ng-valid-maxlength ng-touched',
            { autocapitalize: 'off', autocorrect: 'off', id: 'twoFactorCode', type: 'text', placeholder: 'Two-factor passcode', name: 'twoFactorCode' },
            'Protonmail 2FA',
            true
        ],
        [ // Nextcloud
            '',
            { minlength: '6', maxLength: '10', name: 'challenge', placeholder: 'Authentication code', type: 'tel', },
            'Nextcloud 2FA',
            true
        ],
        [ // Amazon.com
            'a-input-text a-span12 auth-autofocus auth-required-field',
            { autocomplete: 'off', id: 'auth-mfa-otpcode', maxLength: '20', name: 'otpCode', type: 'tel', },
            'Amazon.com 2FA',
            true
        ],
        [ // GMail
            'whsOnd zHQkBf',
            { autocomplete: 'off', id: 'idvPin', tabindex: '0', name: 'idvPin', pattern: '[0-9 ]*', type: 'tel', spellcheck: 'false' },
            'GMail 2FA',
            true
        ],
        [ // Live.com
            'orm-control',
            { autocomplete: 'off', id: 'idTxtBx_SAOTCC_OTC', maxLength: '8', tabindex: '0', name: 'otc', placeholder: 'Code', type: 'tel' },
            'Live.com 2FA',
            true
        ],
    ];

    for (const field of totpFields) {
        assertTOTPField(field[0], field[1], field[2], field[3]);
    }
}

// Run tests
(async () => {
    await Promise.all([
        await testGlobal(),
        await testKeePassXCBrowser(),
        await testTotpFields(),
    ]);
})();
