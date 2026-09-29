(function() {
    'use strict';

    const STORAGE_KEY = 'ownerDashboardAuth';

    function injectBrandVariables() {
        const root = document.documentElement;
        if (typeof BRAND === 'undefined') return;
        root.style.setProperty('--primary', BRAND.primaryColor);
        root.style.setProperty('--primary-dark', BRAND.primaryDark);
        root.style.setProperty('--primary-light', BRAND.primaryLight);
        root.style.setProperty('--background', BRAND.backgroundColor);
        root.style.setProperty('--surface', BRAND.lightBackground);
        root.style.setProperty('--text', BRAND.textColor);
        root.style.setProperty('--muted', BRAND.mutedTextColor);
        root.style.setProperty('--border', BRAND.borderColor);
    }

    function setView(isLoggedIn) {
        document.getElementById('owner-login-view').classList.toggle('owner-hidden', isLoggedIn);
        document.getElementById('owner-dashboard-view').classList.toggle('owner-hidden', !isLoggedIn);
    }

    function showError(id, message) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = message;
        el.classList.remove('owner-hidden');
    }

    function clearError(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = '';
        el.classList.add('owner-hidden');
    }

    function setAuthToken(token) {
        sessionStorage.setItem(STORAGE_KEY, token);
    }

    function getAuthToken() {
        return sessionStorage.getItem(STORAGE_KEY) || '';
    }

    function clearAuthToken() {
        sessionStorage.removeItem(STORAGE_KEY);
    }

    function getApiUrl(path) {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        const base = typeof API_BASE_URL !== 'undefined' ? String(API_BASE_URL).trim() : '';
        if (!base) return cleanPath;
        return base.replace(/\/+$/, '') + cleanPath;
    }

    function setLoginFieldErrorState(hasError) {
        ['owner-username', 'owner-password'].forEach(function(id) {
            const input = document.getElementById(id);
            if (!input) return;
            input.classList.toggle('error', hasError);
            input.setAttribute('aria-invalid', hasError ? 'true' : 'false');
        });
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('en-NG');
    }

    function formatMoney(value) {
        const currency = (typeof BUSINESS !== 'undefined' && BUSINESS.currency) ? BUSINESS.currency : '₦';
        return currency + formatNumber(value);
    }

    const CONFIG_GROUPS = [
        ['BUSINESS', 'Business', 'Company identity, contact details, currency, and website.'],
        ['API_BASE_URL', 'API Connection', 'Frontend API base URL. Leave empty when using the same domain.'],
        ['BRAND', 'Branding', 'Colors and visual brand settings.'],
        ['SECTION_VISIBILITY', 'Homepage Sections', 'Enable or disable complete homepage sections.'],
        ['PRODUCT', 'Product', 'Product identity, descriptions, pricing, and rating.'],
        ['PRODUCT_TYPE', 'Product Type', 'Use physical or digital checkout behavior.'],
        ['PRODUCT_IMAGES', 'Product Images', 'Image paths and descriptions. Use productsimages/filename.ext.'],
        ['PRODUCT_VIDEOS', 'Product Videos', 'YouTube video titles, URLs, and enabled state.'],
        ['FEATURES', 'Features', 'Product feature cards.'],
        ['SPECIFICATIONS', 'Specifications', 'Technical specification rows.'],
        ['PACKAGES', 'Packages', 'Quantities, package prices, badges, and descriptions.'],
        ['DELIVERY', 'Delivery', 'Delivery content and timing.'],
        ['GUARANTEE', 'Guarantee', 'Trust and assurance content.'],
        ['WHY_CHOOSE', 'Why Choose Us', 'Reasons customers should choose the product.'],
        ['TESTIMONIALS', 'Testimonials', 'Customer reviews and images. Use genuine reviews only.'],
        ['FAQ', 'FAQ', 'Frequently asked questions and policy entries.'],
        ['WHATSAPP_NUMBERS', 'WhatsApp', 'Sales numbers used by WhatsApp buttons.'],
        ['PAYMENT', 'Payments', 'Paystack public key and payment method switches.'],
        ['MANUAL_PAYMENT', 'Manual Payment', 'Bank transfer instructions and account details.'],
        ['SOCIAL_LINKS', 'Social Links', 'Footer social media URLs.'],
        ['LOGO', 'Logo', 'Logo type, file, text, and alt text.'],
        ['NAVIGATION', 'Navigation', 'Header navigation links.'],
        ['FOOTER_LINKS', 'Footer Links', 'Footer quick and legal links.'],
        ['SEO', 'SEO', 'Search and social sharing metadata.'],
        ['ANALYTICS', 'Analytics', 'Optional tracking IDs.'],
        ['SALES_POPUP', 'Sales Popup', 'Live order notification settings.'],
        ['PROMOTION', 'Promotion Timer', 'Promotion banner, duration, and end date.'],
        ['SOCIAL_PROOF_GALLERY', 'Social Proof Gallery', 'Customer and lifestyle gallery.'],
        ['COMPANY', 'Company', 'Company description, mission, and values.'],
        ['TRUST_BADGES', 'Trust Badges', 'Homepage trust badges.'],
        ['CONTACT', 'Contact', 'Contact section details.'],
        ['ABOUT_PRODUCT', 'About Product', 'About-product section content.'],
        ['HERO_TRUST', 'Hero Trust', 'Hero trust labels.'],
        ['STICKY_CTA', 'Sticky CTA', 'Sticky mobile call-to-action settings.']
    ];
    let settingsDraft = {};
    let activeSettingsKey = CONFIG_GROUPS[0][0];

    function getDefaultConfig() {
        const config = {};
        CONFIG_GROUPS.forEach(function(group) {
            config[group[0]] = window[group[0]];
        });
        return config;
    }

    function cloneConfig(config) {
        return JSON.parse(JSON.stringify(config || {}));
    }

    function renderSettingsNavigation() {
        const nav = document.getElementById('owner-settings-nav');
        if (!nav) return;
        nav.innerHTML = '';
        CONFIG_GROUPS.forEach(function(group) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = group[1];
            button.classList.toggle('active', group[0] === activeSettingsKey);
            button.addEventListener('click', function() {
                readSettingsEditor();
                activeSettingsKey = group[0];
                renderSettingsNavigation();
                renderSettingsEditor();
            });
            nav.appendChild(button);
        });
    }

    function renderSettingsEditor() {
        const group = CONFIG_GROUPS.find(function(item) { return item[0] === activeSettingsKey; });
        const editor = document.getElementById('owner-settings-form');
        const title = document.getElementById('owner-settings-title');
        const description = document.getElementById('owner-settings-description');
        if (!group || !editor) return;

        title.textContent = group[1];
        description.textContent = group[2] + ' Update the fields below, then save all settings.';
        editor.innerHTML = '';
        editor.appendChild(createSettingsNode(settingsDraft[group[0]], [], group[1]));
    }

    function readSettingsEditor() {
        return true;
    }

    function humanizeKey(key) {
        return String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, function(char) {
            return char.toUpperCase();
        });
    }

    function isLongText(key, value) {
        return String(value || '').length > 100 || /description|instructions|answer|text|address|subheadline|headline|note/i.test(key);
    }

    function setDraftValue(path, value) {
        if (!path.length) {
            settingsDraft[activeSettingsKey] = value;
            return;
        }
        let target = settingsDraft[activeSettingsKey];
        for (let index = 0; index < path.length - 1; index += 1) target = target[path[index]];
        target[path[path.length - 1]] = value;
    }

    function createSettingsNode(value, path, label) {
        if (Array.isArray(value)) return createSettingsArray(value, path, label);
        if (value && typeof value === 'object') {
            const group = document.createElement('fieldset');
            group.className = 'owner-settings-group';
            const legend = document.createElement('legend');
            legend.textContent = label;
            group.appendChild(legend);
            const fields = document.createElement('div');
            fields.className = 'owner-settings-fields';
            Object.keys(value).forEach(function(key) {
                fields.appendChild(createSettingsField(value[key], path.concat(key), key));
            });
            group.appendChild(fields);
            return group;
        }
        return createSettingsField(value, path, label);
    }

    function createSettingsField(value, path, key) {
        if (Array.isArray(value) || (value && typeof value === 'object')) return createSettingsNode(value, path, humanizeKey(key));

        const wrapper = document.createElement('div');
        wrapper.className = 'owner-settings-field' + (isLongText(key, value) ? ' owner-settings-field-wide' : '');
        const label = document.createElement('label');
        label.textContent = humanizeKey(key);
        wrapper.appendChild(label);

        if (typeof value === 'boolean') {
            const control = document.createElement('span');
            control.className = 'owner-settings-checkbox';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = value;
            input.id = 'owner-field-' + path.join('-');
            input.addEventListener('change', function() {
                setDraftValue(path, input.checked);
                control.lastChild.textContent = input.checked ? 'Enabled' : 'Disabled';
            });
            label.htmlFor = input.id;
            control.appendChild(input);
            control.appendChild(document.createTextNode(input.checked ? 'Enabled' : 'Disabled'));
            wrapper.appendChild(control);
        } else if (typeof value === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = value;
            input.step = Number.isInteger(value) ? '1' : 'any';
            input.addEventListener('input', function() { setDraftValue(path, input.value === '' ? 0 : Number(input.value)); });
            wrapper.appendChild(input);
        } else {
            const isColor = /color/i.test(key) && /^#[0-9a-f]{6}$/i.test(String(value));
            const input = document.createElement(isLongText(key, value) ? 'textarea' : 'input');
            if (input.tagName === 'INPUT') input.type = isColor ? 'color' : (/url|website|href/i.test(key) ? 'url' : 'text');
            input.value = value === null || value === undefined ? '' : value;
            input.addEventListener('input', function() { setDraftValue(path, input.value); });
            wrapper.appendChild(input);
        }
        return wrapper;
    }

    function createSettingsArray(value, path, label) {
        const group = document.createElement('fieldset');
        group.className = 'owner-settings-group';
        const legend = document.createElement('legend');
        legend.textContent = label;
        group.appendChild(legend);
        const list = document.createElement('div');
        list.className = 'owner-settings-array';
        value.forEach(function(item, index) {
            const itemBox = document.createElement('fieldset');
            itemBox.className = 'owner-settings-item';
            const header = document.createElement('div');
            header.className = 'owner-settings-item-header';
            const itemLabel = document.createElement('span');
            itemLabel.textContent = humanizeKey(label) + ' ' + (index + 1);
            header.appendChild(itemLabel);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.addEventListener('click', function() {
                value.splice(index, 1);
                renderSettingsEditor();
            });
            header.appendChild(remove);
            itemBox.appendChild(header);
            itemBox.appendChild(createSettingsNode(item, path.concat(index), 'Item ' + (index + 1)));
            list.appendChild(itemBox);
        });
        group.appendChild(list);
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn btn-secondary owner-settings-add';
        add.textContent = 'Add ' + label.replace(/s$/, '');
        add.addEventListener('click', function() {
            value.push(value.length ? cloneConfig(value[0]) : '');
            renderSettingsEditor();
        });
        group.appendChild(add);
        return group;
    }

    function renderSettings(config) {
        settingsDraft = cloneConfig(Object.assign(getDefaultConfig(), config || {}));
        renderSettingsNavigation();
        renderSettingsEditor();
    }

    async function fetchOwnerConfig(token) {
        const response = await fetch(getApiUrl('/api/owner/config'), {
            method: 'GET',
            headers: { 'Authorization': 'Basic ' + token }
        });
        const data = await response.json().catch(function() { return {}; });
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load store settings');
        return data.config;
    }

    async function loadOwnerConfig() {
        const token = getAuthToken();
        if (!token) return;
        try {
            renderSettings(await fetchOwnerConfig(token));
        } catch (error) {
            showError('owner-settings-error', error.message || 'Unable to load store settings.');
        }
    }

    async function saveOwnerConfig() {
        if (!readSettingsEditor()) return;
        clearError('owner-settings-error');
        const status = document.getElementById('owner-settings-status');
        const button = document.getElementById('owner-settings-save');
        if (button) button.disabled = true;
        if (status) status.textContent = 'Saving...';

        try {
            const response = await fetch(getApiUrl('/api/owner/config'), {
                method: 'PUT',
                headers: {
                    'Authorization': 'Basic ' + getAuthToken(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ config: settingsDraft })
            });
            const data = await response.json().catch(function() { return {}; });
            if (!response.ok || !data.success) throw new Error(data.error || 'Unable to save store settings');
            settingsDraft = cloneConfig(data.config);
            if (status) status.textContent = 'Saved ' + new Date().toLocaleTimeString();
        } catch (error) {
            showError('owner-settings-error', error.message || 'Unable to save store settings.');
            if (status) status.textContent = '';
        } finally {
            if (button) button.disabled = false;
        }
    }

    function initSettings() {
        document.querySelectorAll('[data-owner-tab]').forEach(function(tab) {
            tab.addEventListener('click', function() {
                const name = this.getAttribute('data-owner-tab');
                document.querySelectorAll('[data-owner-tab]').forEach(function(item) {
                    item.classList.toggle('active', item === tab);
                });
                document.querySelectorAll('[data-owner-view]').forEach(function(view) {
                    view.classList.toggle('active', view.getAttribute('data-owner-view') === name);
                });
            });
        });

        const saveButton = document.getElementById('owner-settings-save');
        const resetButton = document.getElementById('owner-settings-reset');
        if (saveButton) saveButton.addEventListener('click', saveOwnerConfig);
        if (resetButton) resetButton.addEventListener('click', function() {
            settingsDraft[activeSettingsKey] = cloneConfig(getDefaultConfig()[activeSettingsKey]);
            renderSettingsEditor();
            clearError('owner-settings-error');
        });
        renderSettings(getDefaultConfig());
    }

    async function fetchStats(token) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(function() {
            controller.abort();
        }, 10000);

        const response = await fetch(getApiUrl('/api/owner/stats'), {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + token
            },
            signal: controller.signal
        }).finally(function() {
            window.clearTimeout(timeoutId);
        });

        const data = await response.json().catch(function() {
            return {};
        });
        if (!response.ok || !data.success) {
            if (response.status === 401) {
                throw new Error('Invalid username or password. Please try again.');
            }
            throw new Error(data.error || 'Unable to load dashboard stats');
        }

        return data.stats;
    }

    function renderStats(stats) {
        document.querySelectorAll('[data-stat]').forEach(function(el) {
            const key = el.getAttribute('data-stat');
            el.textContent = formatNumber(stats[key]);
        });

        document.querySelectorAll('[data-stat-money]').forEach(function(el) {
            const key = el.getAttribute('data-stat-money');
            el.textContent = formatMoney(stats[key]);
        });

        const lastUpdated = document.getElementById('owner-last-updated');
        if (lastUpdated) {
            lastUpdated.textContent = 'Last updated: ' + (stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'No data yet');
        }
    }

    function safeText(value) {
        return String(value === undefined || value === null ? '' : value);
    }

    function showLookupError(message) {
        showError('owner-lookup-error', message);
    }

    function clearLookupError() {
        clearError('owner-lookup-error');
    }

    function hideLookupResult() {
        const box = document.getElementById('owner-lookup-result');
        if (!box) return;
        box.classList.add('owner-hidden');
        box.innerHTML = '';
    }

    function renderLookupResult(record) {
        const box = document.getElementById('owner-lookup-result');
        if (!box) return;

        const customer = record && record.customer ? record.customer : {};
        const rowHtml = function(label, value) {
            if (value === undefined || value === null || value === '') return '';
            return '<div class="owner-lookup-row"><span>' + label + '</span><span>' + safeText(value) + '</span></div>';
        };

        const items = record && Array.isArray(record.items) ? record.items : [];
        const itemsHtml = items.length ? (
            '<h3 style="margin-top:16px;">Items</h3>' +
            items.map(function(item) {
                const title = safeText(item.productTitle || item.productId || '');
                const variant = safeText(item.packageTitle || item.packageId || '');
                const qty = safeText(item.qty || item.quantity || '');
                const total = item.lineTotal !== undefined ? (safeText(item.lineTotal) + ' ' + safeText(record.currency)) : '';
                return '<div class="owner-lookup-row"><span>' + title + (variant ? (' (' + variant + ')') : '') + '</span><span>' + (qty ? ('x' + qty + ' ') : '') + total + '</span></div>';
            }).join('')
        ) : '';

        box.innerHTML = [
            '<h3>Order Details</h3>',
            '<div class="owner-lookup-row"><span>Reference</span><span>' + safeText(record.reference) + '</span></div>',
            '<div class="owner-lookup-row"><span>Order Type</span><span>' + safeText(record.orderType) + '</span></div>',
            '<div class="owner-lookup-row"><span>Payment Status</span><span>' + safeText(record.paymentStatus) + '</span></div>',
            '<div class="owner-lookup-row"><span>Order Status</span><span>' + safeText(record.orderStatus) + '</span></div>',
            '<div class="owner-lookup-row"><span>Package</span><span>' + safeText(record.packageTitle || record.packageId) + '</span></div>',
            '<div class="owner-lookup-row"><span>Quantity</span><span>' + safeText(record.quantity) + '</span></div>',
            '<div class="owner-lookup-row"><span>Amount</span><span>' + safeText(record.amount) + ' ' + safeText(record.currency) + '</span></div>',
            rowHtml('Subtotal', record.subtotal !== undefined ? (safeText(record.subtotal) + ' ' + safeText(record.currency)) : ''),
            rowHtml('Shipping', record.shippingFee !== undefined ? (safeText(record.shippingFee) + ' ' + safeText(record.currency)) : ''),
            rowHtml('Verified At', record.verifiedAt),
            rowHtml('Created At', record.createdAt),
            itemsHtml,
            '<h3 style="margin-top:16px;">Customer</h3>',
            rowHtml('Name', customer.name),
            rowHtml('Email', customer.email),
            rowHtml('Phone', customer.phone),
            rowHtml('Address', [customer.address, customer.city, customer.state].filter(Boolean).join(', ')),
            rowHtml('Special Request', customer.specialRequest),
            (record.warnings && record.warnings.length ? ('<div style="margin-top:14px;color:#b45309;font-size:0.92rem;">Warnings: ' + safeText(record.warnings.join(', ')) + '</div>') : '')
        ].filter(Boolean).join('');

        box.classList.remove('owner-hidden');
    }

    async function fetchOrderByReference(token, reference) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(function() {
            controller.abort();
        }, 10000);

        const response = await fetch(getApiUrl('/api/owner/order?ref=' + encodeURIComponent(reference)), {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + token
            },
            signal: controller.signal
        }).finally(function() {
            window.clearTimeout(timeoutId);
        });

        const data = await response.json().catch(function() {
            return {};
        });

        if (!response.ok || !data.success) {
            if (response.status === 401) {
                throw new Error('Invalid username or password. Please log in again.');
            }
            throw new Error(data.error || 'Unable to load order details');
        }

        return data.record;
    }

    async function loadDashboard() {
        clearError('owner-dashboard-error');
        const token = getAuthToken();
        if (!token) {
            setView(false);
            return;
        }

        try {
            const stats = await fetchStats(token);
            renderStats(stats);
            setView(true);
            await loadOwnerConfig();
            setLoginFieldErrorState(false);
        } catch (error) {
            clearAuthToken();
            setView(false);
            setLoginFieldErrorState(true);
            showError('owner-login-error', error.name === 'AbortError'
                ? 'Dashboard request timed out. Please confirm OWNER_STATS is bound and try again.'
                : (error.message || 'Invalid username or password. Please try again.'));
        }
    }

    function initLookup() {
        const form = document.getElementById('owner-lookup-form');
        const input = document.getElementById('owner-lookup-ref');
        if (!form || !input) return;

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearLookupError();
            hideLookupResult();

            const token = getAuthToken();
            if (!token) {
                showLookupError('Please log in first.');
                return;
            }

            const reference = input.value.trim();
            if (!reference) {
                showLookupError('Enter a payment reference.');
                return;
            }

            try {
                const record = await fetchOrderByReference(token, reference);
                renderLookupResult(record);
            } catch (error) {
                if (String(error.message || '').toLowerCase().includes('log in')) {
                    clearAuthToken();
                    setView(false);
                }
                showLookupError(error.name === 'AbortError' ? 'Request timed out. Please try again.' : (error.message || 'Unable to load order details'));
            }
        });

        input.addEventListener('input', function() {
            clearLookupError();
        });
    }

    function initLogin() {
        const form = document.getElementById('owner-login-form');
        if (!form) return;

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            clearError('owner-login-error');
            setLoginFieldErrorState(false);

            const username = document.getElementById('owner-username').value.trim();
            const password = document.getElementById('owner-password').value;
            const token = btoa(username + ':' + password);

            try {
                const stats = await fetchStats(token);
                setAuthToken(token);
                renderStats(stats);
                setView(true);
                await loadOwnerConfig();
                setLoginFieldErrorState(false);
            } catch (error) {
                setLoginFieldErrorState(true);
                showError('owner-login-error', error.name === 'AbortError'
                    ? 'Dashboard request timed out. Please confirm OWNER_STATS is bound and try again.'
                    : (error.message || 'Invalid username or password. Please try again.'));
            }
        });

        ['owner-username', 'owner-password'].forEach(function(id) {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', function() {
                clearError('owner-login-error');
                setLoginFieldErrorState(false);
            });
        });
    }

    function initActions() {
        const refreshBtn = document.getElementById('owner-refresh-btn');
        const logoutBtn = document.getElementById('owner-logout-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                loadDashboard();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                clearAuthToken();
                clearError('owner-dashboard-error');
                setView(false);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        injectBrandVariables();
        initLogin();
        initLookup();
        initActions();
        initSettings();
        loadDashboard();
    });
})();
