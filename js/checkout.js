(function() {
    'use strict';

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.from((root || document).querySelectorAll(selector));
    }

    function getApiUrl(path) {
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        const base = typeof API_BASE_URL !== 'undefined' ? String(API_BASE_URL).trim() : '';
        if (!base) return cleanPath;
        return base.replace(/\/+$/, '') + cleanPath;
    }

    function isDigitalProduct() {
        return String(typeof PRODUCT_TYPE !== 'undefined' ? PRODUCT_TYPE : 'physical').trim().toLowerCase() === 'digital';
    }

    function generateOrderRef() {
        const prefix = String((BUSINESS && BUSINESS.shortName) ? BUSINESS.shortName : 'ORDER')
            .substring(0, 6)
            .toUpperCase()
            .replace(/\s+/g, '');
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return prefix + '-' + timestamp + random;
    }

    function setSubmitting(form, submitting) {
        const btn = $('button[type="submit"]', form);
        if (!btn) return;
        btn.disabled = submitting;
        btn.style.opacity = submitting ? '0.7' : '';
        btn.style.pointerEvents = submitting ? 'none' : '';
    }

    function clearErrors(form) {
        $all('.error-message', form).forEach(function(el) { el.textContent = ''; });
    }

    function setFieldError(input, message) {
        if (!input) return;
        const group = input.closest('.form-group');
        if (!group) return;
        const msg = $('.error-message', group);
        if (!msg) return;
        msg.textContent = message || '';
    }

    function readCustomer(form) {
        return {
            name: String($('input[name="fullName"]', form).value || '').trim(),
            email: String($('input[name="email"]', form).value || '').trim(),
            phone: String($('input[name="phone"]', form).value || '').trim(),
            address: String($('textarea[name="address"]', form).value || '').trim(),
            state: String($('input[name="state"]', form).value || '').trim(),
            city: String($('input[name="city"]', form).value || '').trim(),
            specialRequest: String($('textarea[name="specialRequest"]', form).value || '').trim()
        };
    }

    function getSelectedPayment(form) {
        const input = $('input[name="payment"]:checked', form);
        return input ? String(input.value || '').trim() : 'paystack';
    }

    function getSelectedPackage() {
        if (window.selectedPackage) return window.selectedPackage;
        const hidden = $('input[name="package"]');
        const pkgId = hidden ? String(hidden.value || '').trim() : '';
        const list = typeof PACKAGES !== 'undefined' && Array.isArray(PACKAGES) ? PACKAGES : [];
        return list.find(function(p) { return p && p.id === pkgId; }) || (list.length ? list[0] : null);
    }

    async function verifyPayment(payload) {
        const res = await fetch(getApiUrl('/api/verify-payment'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(function() { return {}; });
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Payment verification failed');
        }
        return data;
    }

    async function trackOrderAttempt(orderRef, event, extra) {
        try {
            const body = Object.assign({ order_ref: String(orderRef || ''), event: String(event || '') }, extra || {});
            await fetch(getApiUrl('/api/track-order-attempt'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).catch(function() {});
        } catch (e) {}
    }

    function openFlutterwavePayment(payload, customer, currency) {
        return new Promise(function(resolve, reject) {
            const publicKey = String((PAYMENT && PAYMENT.flutterwavePublicKey) ? PAYMENT.flutterwavePublicKey : '').trim();
            const orderRef = String(payload.order_ref || '');
            const amount = Number(payload.expected_amount || 0);
            const fw = typeof window.FlutterwaveCheckout !== 'undefined' ? window.FlutterwaveCheckout
                : (typeof window.getpaidSetup !== 'undefined' ? window.getpaidSetup : null);
            if (!fw || typeof fw !== 'function') {
                reject(new Error('Flutterwave SDK not loaded'));
                return;
            }
            try {
                fw({
                    public_key: publicKey,
                    tx_ref: orderRef,
                    amount: amount,
                    currency: currency,
                    customer: {
                        email: String(customer.email || ''),
                        name: String(customer.name || ''),
                        phone_number: String(customer.phone || '')
                    },
                    meta: {
                        order_ref: orderRef,
                        customer_name: String(customer.name || ''),
                        customer_phone: String(customer.phone || ''),
                        product_id: String(payload.product_id || ''),
                        package_id: String(payload.package_id || '')
                    },
                    callback: function(response) {
                        const txRef = response && (response.tx_ref || response.txRef) ? String(response.tx_ref || response.txRef) : orderRef;
                        const transactionId = response && (response.transaction_id || response.transactionId || response.id)
                            ? String(response.transaction_id || response.transactionId || response.id) : '';
                        trackOrderAttempt(orderRef, 'flutterwave_callback', { tx_ref: txRef, transaction_id: transactionId, status: String(response && response.status || '') });
                        resolve({ response: response, tx_ref: txRef, transaction_id: transactionId });
                    },
                    onclose: function() {
                        trackOrderAttempt(orderRef, 'flutterwave_closed', {});
                        reject(new Error('Payment window closed'));
                    }
                });
                trackOrderAttempt(orderRef, 'flutterwave_started', { amount: amount, currency: currency });
            } catch (error) {
                reject(error && error.message ? error : new Error('Failed to open Flutterwave checkout'));
            }
        });
    }

    async function submitManualOrder(payload, receiptFile) {
        const formData = new FormData();
        formData.append('order_ref', String(payload.order_ref || ''));
        formData.append('payment_method', 'manual');
        formData.append('currency', String(payload.currency || ''));
        formData.append('amount', String(payload.expected_amount || 0));
        formData.append('shipping_fee', String(payload.shipping_fee || 0));
        formData.append('product_id', String(payload.product_id || ''));
        formData.append('package_id', String(payload.package_id || ''));
        formData.append('product', String(payload.product_title || ''));
        formData.append('package_title', String(payload.package_title || ''));
        formData.append('quantity', String(payload.quantity || 1));
        formData.append('product_type', String(payload.product_type || 'physical'));

        const customer = payload.customer || {};
        formData.append('customer_name', String(customer.name || ''));
        formData.append('customer_email', String(customer.email || ''));
        formData.append('customer_phone', String(customer.phone || ''));
        formData.append('customer_address', String(customer.address || ''));
        formData.append('customer_state', String(customer.state || ''));
        formData.append('customer_city', String(customer.city || ''));
        formData.append('customer_special_request', String(customer.specialRequest || ''));

        if (receiptFile) {
            formData.append('payment_receipt', receiptFile, receiptFile.name);
        }

        const res = await fetch(getApiUrl('/api/manual-order'), { method: 'POST', body: formData });
        const data = await res.json().catch(function() { return {}; });
        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Manual order submission failed');
        }
        return data;
    }

    function initPaymentUi(form) {
        const methods = $all('.payment-method', form);
        const manualInfo = $('.manual-payment-info', form);
        const receiptGroup = $('#manual-receipt-group', form);
        const manualRadio = $('input[name="payment"][value="manual"]', form);
        const paystackRadio = $('input[name="payment"][value="paystack"]', form);
        const flutterwaveRadio = $('input[name="payment"][value="flutterwave"]', form);

        const paystackEnabled = Boolean(PAYMENT && PAYMENT.paystackEnabled);
        const flutterwaveEnabled = Boolean(PAYMENT && PAYMENT.flutterwaveEnabled);
        const manualEnabled = Boolean(PAYMENT && PAYMENT.manualEnabled && MANUAL_PAYMENT && MANUAL_PAYMENT.enabled);

        methods.forEach(function(card) {
            const key = String(card.getAttribute('data-payment') || '');
            if (key === 'paystack') card.style.display = paystackEnabled ? '' : 'none';
            if (key === 'flutterwave') card.style.display = flutterwaveEnabled ? '' : 'none';
            if (key === 'manual') card.style.display = manualEnabled ? '' : 'none';
        });

        function renderManualInfo() {
            if (!manualInfo) return;
            if (!manualEnabled) {
                manualInfo.innerHTML = '';
                return;
            }
            manualInfo.innerHTML =
                '<div style="margin-top:14px;padding:14px;border:1px solid var(--border);border-radius:14px;background:#fff;display:grid;gap:8px;">' +
                '<div style="font-weight:800;">Bank Transfer Details</div>' +
                '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:var(--muted);">Bank</span><span style="font-weight:800;">' + String(MANUAL_PAYMENT.bankName || '') + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:var(--muted);">Account Name</span><span style="font-weight:800;">' + String(MANUAL_PAYMENT.accountName || '') + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;gap:10px;"><span style="color:var(--muted);">Account Number</span><span style="font-weight:900;">' + String(MANUAL_PAYMENT.accountNumber || '') + '</span></div>' +
                (MANUAL_PAYMENT.paymentDeadline ? ('<div style="margin-top:6px;color:var(--muted);font-size:13px;line-height:1.6;">' + String(MANUAL_PAYMENT.paymentDeadline || '') + '</div>') : '') +
                (MANUAL_PAYMENT.instructions ? ('<div style="margin-top:6px;color:var(--muted);font-size:13px;line-height:1.6;">' + String(MANUAL_PAYMENT.instructions || '') + '</div>') : '') +
                '</div>';
        }

        function syncSelectedState() {
            const selected = getSelectedPayment(form);
            methods.forEach(function(card) {
                card.classList.toggle('selected', String(card.getAttribute('data-payment') || '') === selected);
            });

            if (receiptGroup) {
                const showReceipt = selected === 'manual' && Boolean(PAYMENT && PAYMENT.manualReceiptRequired);
                receiptGroup.style.display = showReceipt ? '' : 'none';
                const input = $('#paymentReceipt', form);
                if (input) input.required = Boolean(showReceipt);
            }
        }

        renderManualInfo();

        if (paystackEnabled && paystackRadio) paystackRadio.checked = true;
        if (!paystackEnabled && flutterwaveEnabled && flutterwaveRadio) flutterwaveRadio.checked = true;
        if (!paystackEnabled && !flutterwaveEnabled && manualEnabled && manualRadio) manualRadio.checked = true;
        if (!manualEnabled && !flutterwaveEnabled && paystackEnabled && paystackRadio) paystackRadio.checked = true;
        if (!manualEnabled && !paystackEnabled && flutterwaveEnabled && flutterwaveRadio) flutterwaveRadio.checked = true;

        methods.forEach(function(card) {
            card.addEventListener('click', function() {
                const key = String(card.getAttribute('data-payment') || '');
                const input = $('input[name="payment"][value="' + key + '"]', form);
                if (input) input.checked = true;
                syncSelectedState();
            });
        });

        $all('input[name="payment"]', form).forEach(function(input) {
            input.addEventListener('change', syncSelectedState);
        });

        syncSelectedState();
    }

    function applyProductTypeToForm(form) {
        const needsDelivery = !isDigitalProduct();
        $all('[data-delivery-field="address"]', form).forEach(function(el) { el.style.display = needsDelivery ? '' : 'none'; });
        $all('[data-delivery-field="location"]', form).forEach(function(el) { el.style.display = needsDelivery ? '' : 'none'; });

        const address = $('textarea[name="address"]', form);
        if (address) address.required = Boolean(needsDelivery);
    }

    function validateForm(form) {
        clearErrors(form);
        const customer = readCustomer(form);

        if (!customer.name) setFieldError($('input[name="fullName"]', form), 'Full name is required.');
        if (!customer.email) setFieldError($('input[name="email"]', form), 'Email is required.');
        if (!customer.phone) setFieldError($('input[name="phone"]', form), 'Phone number is required.');

        if (!isDigitalProduct() && !customer.address) {
            setFieldError($('textarea[name="address"]', form), 'Delivery address is required.');
        }

        const method = getSelectedPayment(form);
        if (method === 'manual' && Boolean(PAYMENT && PAYMENT.manualReceiptRequired)) {
            const receipt = $('#paymentReceipt', form);
            const file = receipt && receipt.files && receipt.files[0] ? receipt.files[0] : null;
            if (!file) setFieldError(receipt, 'Payment receipt is required.');
        }

        const hasErrors = $all('.error-message', form).some(function(el) { return Boolean(String(el.textContent || '').trim()); });
        return !hasErrors;
    }

    document.addEventListener('DOMContentLoaded', function() {
        window.PMELAB_CONFIG_READY.then(function() {
        const form = $('#checkout-form');
        if (!form) return;

        applyProductTypeToForm(form);
        initPaymentUi(form);

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!validateForm(form)) return;

            const pkg = getSelectedPackage();
            if (!pkg) return;

            const orderRef = generateOrderRef();
            const method = getSelectedPayment(form);
            const customer = readCustomer(form);
            const currency = String((PAYMENT && PAYMENT.currency) ? PAYMENT.currency : (BUSINESS && BUSINESS.currencyCode ? BUSINESS.currencyCode : 'NGN')).toUpperCase();

            const payload = {
                order_ref: orderRef,
                reference: orderRef,
                package_id: String(pkg.id || 'single'),
                package_title: String(pkg.title || pkg.id || ''),
                expected_amount: Number(pkg.price || 0),
                currency: currency,
                customer: customer,
                product_id: 'singleproduct',
                product_title: String(PRODUCT && PRODUCT.name ? PRODUCT.name : ''),
                quantity: Number(pkg.quantity || 1) || 1,
                shipping_fee: 0,
                product_type: String(isDigitalProduct() ? 'digital' : 'physical')
            };

            if (method === 'manual') {
                const receipt = $('#paymentReceipt', form);
                const file = receipt && receipt.files && receipt.files[0] ? receipt.files[0] : null;
                setSubmitting(form, true);
                submitManualOrder(payload, file)
                    .then(function() {
                        window.location.href = 'success.html?ref=' + encodeURIComponent(orderRef);
                    })
                    .catch(function(error) {
                        setFieldError(receipt, error && error.message ? error.message : 'Manual order submission failed.');
                    })
                    .finally(function() {
                        setSubmitting(form, false);
                    });
                return;
            }

            if (method === 'flutterwave') {
                if (!PAYMENT || !PAYMENT.flutterwaveEnabled) return;
                if (!PAYMENT.flutterwavePublicKey) return;
                if (typeof window.FlutterwaveCheckout === 'undefined' && typeof window.getpaidSetup === 'undefined') return;
                setSubmitting(form, true);
                openFlutterwavePayment(payload, customer, currency)
                    .then(function(result) {
                        const txRef = (result && result.tx_ref) || orderRef;
                        const transactionId = (result && result.transaction_id) || '';
                        return verifyPayment(Object.assign({}, payload, {
                            provider: 'flutterwave',
                            tx_ref: txRef,
                            transaction_id: transactionId,
                            reference: txRef
                        })).then(function() {
                            window.location.href = 'success.html?ref=' + encodeURIComponent(txRef);
                        }).catch(function(error) {
                            window.location.href = 'payment-failed.html?ref=' + encodeURIComponent(txRef) + '&reason=' + encodeURIComponent(error && error.message ? error.message : 'Payment verification failed');
                        });
                    })
                    .catch(function() {
                        setSubmitting(form, false);
                    });
                return;
            }

            if (!PAYMENT || !PAYMENT.paystackEnabled) return;
            if (!PAYMENT.paystackPublicKey) return;
            if (typeof PaystackPop === 'undefined' || !PaystackPop || typeof PaystackPop.setup !== 'function') return;

            setSubmitting(form, true);
            trackOrderAttempt(orderRef, 'paystack_started', { amount: Math.round(Number(payload.expected_amount || 0) * 100), currency: currency });
            const handler = PaystackPop.setup({
                key: PAYMENT.paystackPublicKey,
                email: customer.email,
                amount: Math.round(Number(payload.expected_amount || 0) * 100),
                currency: currency,
                ref: orderRef,
                metadata: {
                    custom_fields: [
                        { display_name: 'Customer Name', variable_name: 'customer_name', value: customer.name },
                        { display_name: 'Phone', variable_name: 'customer_phone', value: customer.phone }
                    ]
                },
                callback: function(response) {
                    const reference = response && response.reference ? String(response.reference) : orderRef;
                    verifyPayment(Object.assign({}, payload, { provider: 'paystack', reference: reference }))
                        .then(function() {
                            window.location.href = 'success.html?ref=' + encodeURIComponent(reference);
                        })
                        .catch(function(error) {
                            window.location.href = 'payment-failed.html?ref=' + encodeURIComponent(reference) + '&reason=' + encodeURIComponent(error && error.message ? error.message : 'Payment verification failed');
                        })
                        .finally(function() {
                            setSubmitting(form, false);
                        });
                },
                onClose: function() {
                    trackOrderAttempt(orderRef, 'paystack_closed', {});
                    setSubmitting(form, false);
                }
            });
            handler.openIframe();
        });
        });
    });
})();
