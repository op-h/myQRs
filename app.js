(function () {
    "use strict";

    const STORAGE_KEY = "myqrs.saved.v1";
    const SECURE_PREFIX = "myqrs-secure:";
    const MAX_SAVED_ITEMS = 12;
    const QR_SIZE = 280;
    const QR_DELAY_MS = 120;

    const state = {
        mode: "url",
        showLabel: false,
        filename: "qrcode.png",
        textToEncode: "",
        currentCanvas: null,
        savedItems: [],
        pendingSecurePayload: null,
        renderToken: 0,
        renderTimeoutId: 0
    };

    const elements = {
        tabs: Array.from(document.querySelectorAll(".tab-btn")),
        sections: Array.from(document.querySelectorAll(".mode-panel")),
        qrcode: document.getElementById("qrcode"),
        finalCanvasWrapper: document.getElementById("finalCanvasWrapper"),
        qrFilename: document.getElementById("qrFilename"),
        globalError: document.getElementById("globalError"),
        globalNotice: document.getElementById("globalNotice"),
        savedList: document.getElementById("savedList"),
        customLabelSection: document.getElementById("customLabelSection"),
        customLabelInput: document.getElementById("customLabelInput"),
        showLabelToggle: document.getElementById("showLabelToggle"),
        saveBtn: document.getElementById("saveBtn"),
        downloadBtn: document.getElementById("downloadBtn"),
        copyBtn: document.getElementById("copyBtn"),
        shareBtn: document.getElementById("shareBtn"),
        clearFormBtn: document.getElementById("clearFormBtn"),
        clearSavedBtn: document.getElementById("clearSavedBtn"),
        secureQrUpload: document.getElementById("secureQrUpload"),
        secureDecodeStatus: document.getElementById("secureDecodeStatus"),
        decryptedMessageCard: document.getElementById("decryptedMessageCard"),
        decryptedMessageOutput: document.getElementById("decryptedMessageOutput"),
        unlockDialog: document.getElementById("unlockDialog"),
        unlockForm: document.getElementById("unlockForm"),
        unlockHint: document.getElementById("unlockHint"),
        unlockCodeInput: document.getElementById("unlockCodeInput"),
        unlockError: document.getElementById("unlockError"),
        closeUnlockDialogBtn: document.getElementById("closeUnlockDialogBtn"),
        inputs: {
            url: document.getElementById("urlInput"),
            text: document.getElementById("textInput"),
            ssid: document.getElementById("ssidInput"),
            password: document.getElementById("passwordInput"),
            encryption: document.getElementById("encryptionSelect"),
            hidden: document.getElementById("hiddenCheckbox"),
            name: document.getElementById("nameInput"),
            phone: document.getElementById("phoneInput"),
            emailTo: document.getElementById("emailToInput"),
            emailSubject: document.getElementById("emailSubjectInput"),
            emailBody: document.getElementById("emailBodyInput"),
            secureMessage: document.getElementById("secureMessageInput"),
            secureCode: document.getElementById("secureCodeInput"),
            secureHint: document.getElementById("secureHintInput")
        },
        errors: {
            url: document.getElementById("urlError"),
            text: document.getElementById("textError"),
            ssid: document.getElementById("ssidError"),
            name: document.getElementById("nameError"),
            phone: document.getElementById("phoneError"),
            emailTo: document.getElementById("emailToError"),
            secureMessage: document.getElementById("secureMessageError"),
            secureCode: document.getElementById("secureCodeError")
        }
    };

    const validationRules = {
        url: {
            test(value) {
                if (!value) {
                    return "Enter a URL.";
                }
                try {
                    const normalized = normalizeUrl(value);
                    const parsed = new URL(normalized);
                    if (!/^https?:$/i.test(parsed.protocol)) {
                        return "Use http or https.";
                    }
                    return "";
                } catch (_) {
                    return "Enter a valid URL.";
                }
            }
        },
        text: {
            test(value) {
                return value.length > 1500 ? "Text is too long for a stable QR code." : "";
            }
        },
        ssid: {
            test(value) {
                return value.trim() ? "" : "Network name is required.";
            }
        },
        name: {
            test(value) {
                return value.trim() ? "" : "Full name is required.";
            }
        },
        phone: {
            test(value) {
                return /^\+?[0-9\s\-()]{7,}$/.test(value.trim()) ? "" : "Enter a valid phone number.";
            }
        },
        emailTo: {
            test(value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? "" : "Enter a valid email address.";
            }
        },
        secureMessage: {
            test(value) {
                if (!value.trim()) {
                    return "Secret message is required.";
                }
                return value.length > 12000 ? "Protected messages are too large for one QR code." : "";
            }
        },
        secureCode: {
            test(value) {
                return value.trim().length >= 4 ? "" : "Use a code with at least 4 characters.";
            }
        }
    };

    function init() {
        bindEvents();
        loadSavedItems();
        renderSavedItems();
        syncLabelToggle();
        hydrateSecurePayloadFromUrl();
        updateShareAvailability();
        state.mode = "url";
        elements.inputs.url.value = "https://example.com";
        requestGenerate();
    }

    function bindEvents() {
        elements.tabs.forEach((tab) => {
            tab.addEventListener("click", () => switchMode(tab.dataset.mode));
        });

        Object.values(elements.inputs).forEach((input) => {
            const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
            input.addEventListener(eventName, requestGenerate);
        });

        elements.inputs.url.addEventListener("blur", () => {
            if (!elements.inputs.url.value.trim()) {
                return;
            }
            elements.inputs.url.value = normalizeUrl(elements.inputs.url.value.trim());
            requestGenerate();
        });

        elements.inputs.encryption.addEventListener("change", () => {
            const isNone = elements.inputs.encryption.value === "nopass";
            elements.inputs.password.disabled = isNone;
            if (isNone) {
                elements.inputs.password.value = "";
            }
        });

        elements.showLabelToggle.addEventListener("click", () => {
            state.showLabel = !state.showLabel;
            if (state.showLabel && !elements.customLabelInput.value.trim()) {
                elements.customLabelInput.value = getDefaultLabel();
            }
            syncLabelToggle();
            requestGenerate();
        });

        elements.downloadBtn.addEventListener("click", downloadCurrentQr);
        elements.copyBtn.addEventListener("click", copyCurrentQr);
        elements.shareBtn.addEventListener("click", shareCurrentQr);
        elements.saveBtn.addEventListener("click", saveCurrentQr);
        elements.clearFormBtn.addEventListener("click", resetActiveModeFields);
        elements.clearSavedBtn.addEventListener("click", clearSavedItems);
        elements.secureQrUpload.addEventListener("change", handleSecureUpload);
        elements.unlockForm.addEventListener("submit", handleUnlockSubmit);
        elements.closeUnlockDialogBtn.addEventListener("click", closeUnlockDialog);
        elements.unlockDialog.addEventListener("close", resetUnlockDialog);
    }

    const requestGenerate = debounce(async () => {
        clearBanner();
        clearFieldErrors();
        const token = state.renderToken + 1;
        state.renderToken = token;
        window.clearTimeout(state.renderTimeoutId);

        try {
            const payload = await buildPayloadForCurrentMode();
            if (!payload) {
                clearPreview();
                return;
            }

            state.textToEncode = payload.text;
            state.filename = payload.filename;

            renderBaseQr(payload.text);
            state.renderTimeoutId = window.setTimeout(() => {
                if (token !== state.renderToken) {
                    return;
                }
                drawFinalCanvas(payload.label);
                elements.qrFilename.textContent = payload.filename;
            }, QR_DELAY_MS);
        } catch (error) {
            showBanner("error", error.message || "Failed to generate QR code.");
            clearPreview();
        }
    }, 220);

    function switchMode(mode) {
        state.mode = mode;
        elements.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.mode === mode));
        elements.sections.forEach((section) => section.classList.toggle("is-active", section.dataset.section === mode));
        if (state.showLabel) {
            elements.customLabelInput.value = elements.customLabelInput.value.trim() || getDefaultLabel();
        }
        clearBanner();
        clearFieldErrors();
        requestGenerate();
    }

    async function buildPayloadForCurrentMode() {
        const mode = state.mode;

        switch (mode) {
            case "url": {
                const raw = elements.inputs.url.value.trim();
                if (!raw) {
                    return null;
                }
                const error = validationRules.url.test(raw);
                if (error) {
                    setFieldError("url", error);
                    return null;
                }
                const normalized = normalizeUrl(raw);
                return {
                    text: normalized,
                    filename: `${slugify(extractLabelFromUrl(normalized) || "website")}.png`,
                    label: resolveLabel(extractLabelFromUrl(normalized) || "Website")
                };
            }
            case "text": {
                const text = elements.inputs.text.value;
                const error = validationRules.text.test(text);
                if (error) {
                    setFieldError("text", error);
                    return null;
                }
                if (!text.trim()) {
                    return null;
                }
                return {
                    text,
                    filename: "text_qr.png",
                    label: resolveLabel("Text")
                };
            }
            case "wifi": {
                const ssid = elements.inputs.ssid.value.trim();
                if (!ssid) {
                    return null;
                }
                const ssidError = validationRules.ssid.test(ssid);
                if (ssidError) {
                    setFieldError("ssid", ssidError);
                    return null;
                }
                const password = elements.inputs.password.value;
                const encryption = elements.inputs.encryption.value;
                const hidden = elements.inputs.hidden.checked ? "true" : "false";
                const wifiString = `WIFI:T:${encryption};S:${escapeWifiString(ssid)};P:${escapeWifiString(password)};H:${hidden};;`;
                return {
                    text: wifiString,
                    filename: `wifi_${slugify(ssid)}.png`,
                    label: resolveLabel(ssid)
                };
            }
            case "contact": {
                const name = elements.inputs.name.value.trim();
                const phone = elements.inputs.phone.value.trim();
                if (!name && !phone) {
                    return null;
                }
                const nameError = validationRules.name.test(name);
                const phoneError = validationRules.phone.test(phone);
                if (nameError) {
                    setFieldError("name", nameError);
                }
                if (phoneError) {
                    setFieldError("phone", phoneError);
                }
                if (nameError || phoneError) {
                    return null;
                }
                const parts = name.split(" ");
                const lastName = parts.pop() || "";
                const firstName = parts.join(" ");
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:${lastName};${firstName};;;\nFN:${name}\nTEL;TYPE=CELL,VOICE:${phone}\nEND:VCARD`;
                return {
                    text: vcard,
                    filename: `contact_${slugify(name)}.png`,
                    label: resolveLabel(name)
                };
            }
            case "email": {
                const to = elements.inputs.emailTo.value.trim();
                if (!to) {
                    return null;
                }
                const error = validationRules.emailTo.test(to);
                if (error) {
                    setFieldError("emailTo", error);
                    return null;
                }
                const subject = encodeURIComponent(elements.inputs.emailSubject.value.trim());
                const body = encodeURIComponent(elements.inputs.emailBody.value);
                const href = `mailto:${to}?subject=${subject}&body=${body}`;
                return {
                    text: href,
                    filename: `email_${slugify(to)}.png`,
                    label: resolveLabel(`Email ${to}`)
                };
            }
            case "secure": {
                const message = elements.inputs.secureMessage.value;
                const code = elements.inputs.secureCode.value;
                const hint = elements.inputs.secureHint.value.trim();
                if (!message.trim() && !code.trim() && !hint) {
                    return null;
                }
                const messageError = validationRules.secureMessage.test(message);
                const codeError = validationRules.secureCode.test(code);
                if (messageError) {
                    setFieldError("secureMessage", messageError);
                }
                if (codeError) {
                    setFieldError("secureCode", codeError);
                }
                if (messageError || codeError) {
                    return null;
                }
                const secureText = await buildSecurePayload(message, code, hint);
                return {
                    text: secureText,
                    filename: `protected_${slugify(hint || "message")}.png`,
                    label: resolveLabel(hint || "Protected QR")
                };
            }
            default:
                return null;
        }
    }

    function renderBaseQr(text) {
        elements.qrcode.innerHTML = "";
        const level = getQrCorrectionLevel(text);
        new QRCode(elements.qrcode, {
            text,
            width: QR_SIZE,
            height: QR_SIZE,
            colorDark: "#08120d",
            colorLight: "#ffffff",
            correctLevel: level
        });
    }

    function drawFinalCanvas(label) {
        const sourceCanvas = elements.qrcode.querySelector("canvas");
        const sourceImage = elements.qrcode.querySelector("img");
        const source = sourceCanvas || sourceImage;

        if (!source) {
            throw new Error("QR render failed.");
        }

        const normalizedLabel = state.showLabel ? (label || "").slice(0, 34) : "";
        const labelHeight = normalizedLabel ? 42 : 0;
        const canvas = document.createElement("canvas");
        canvas.width = QR_SIZE;
        canvas.height = QR_SIZE + labelHeight;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, 0, 0, QR_SIZE, QR_SIZE);

        if (normalizedLabel) {
            ctx.fillStyle = "#08120d";
            ctx.font = "600 16px 'Segoe UI'";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(normalizedLabel, canvas.width / 2, QR_SIZE + 21);
        }

        state.currentCanvas = canvas;
        elements.finalCanvasWrapper.innerHTML = "";
        elements.finalCanvasWrapper.classList.remove("empty");
        elements.finalCanvasWrapper.appendChild(canvas);
    }

    function clearPreview() {
        window.clearTimeout(state.renderTimeoutId);
        state.currentCanvas = null;
        state.textToEncode = "";
        state.filename = "qrcode.png";
        elements.qrcode.innerHTML = "";
        elements.qrFilename.textContent = "No QR generated yet";
        elements.finalCanvasWrapper.innerHTML = [
            '<div class="qr-placeholder">',
            "<strong>Waiting for content</strong>",
            "<span>Fill any section to generate a QR code instantly.</span>",
            "</div>"
        ].join("");
        elements.finalCanvasWrapper.classList.add("empty");
    }

    function setFieldError(name, message) {
        if (elements.errors[name]) {
            elements.errors[name].textContent = message;
        }
    }

    function clearFieldErrors() {
        Object.values(elements.errors).forEach((el) => {
            el.textContent = "";
        });
    }

    function showBanner(kind, message) {
        clearBanner();
        const target = kind === "error" ? elements.globalError : elements.globalNotice;
        target.textContent = message;
        target.classList.remove("hidden");
    }

    function clearBanner() {
        elements.globalError.classList.add("hidden");
        elements.globalNotice.classList.add("hidden");
        elements.globalError.textContent = "";
        elements.globalNotice.textContent = "";
    }

    async function saveCurrentQr() {
        if (!state.currentCanvas) {
            showBanner("error", "Generate a QR code before saving it.");
            return;
        }

        const item = {
            id: `${Date.now()}`,
            filename: state.filename,
            mode: state.mode,
            label: resolveLabel(getDefaultLabel()) || "Saved QR",
            dataUrl: state.currentCanvas.toDataURL("image/png"),
            createdAt: new Date().toISOString()
        };

        try {
            state.savedItems = [item].concat(state.savedItems).slice(0, MAX_SAVED_ITEMS);
            persistSavedItems();
            renderSavedItems();
            showBanner("success", "QR code saved in this browser.");
        } catch (_) {
            showBanner("error", "Browser storage is full or unavailable.");
        }
    }

    function loadSavedItems() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            state.savedItems = raw ? JSON.parse(raw) : [];
        } catch (_) {
            state.savedItems = [];
        }
    }

    function persistSavedItems() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedItems));
    }

    function renderSavedItems() {
        elements.savedList.innerHTML = "";

        if (!state.savedItems.length) {
            const empty = document.createElement("div");
            empty.className = "saved-empty";
            empty.textContent = "No saved QR codes yet.";
            elements.savedList.appendChild(empty);
            return;
        }

        state.savedItems.forEach((item) => {
            const wrapper = document.createElement("article");
            wrapper.className = "saved-item";
            wrapper.innerHTML = [
                `<img src="${item.dataUrl}" alt="${escapeHtml(item.label)}">`,
                `<div><h3>${escapeHtml(item.label)}</h3><div class="saved-meta">${escapeHtml(item.mode.toUpperCase())} • ${formatDate(item.createdAt)}</div></div>`,
                '<div class="saved-actions"></div>'
            ].join("");

            const actions = wrapper.querySelector(".saved-actions");
            const viewBtn = document.createElement("button");
            viewBtn.className = "secondary-btn";
            viewBtn.type = "button";
            viewBtn.textContent = "Preview";
            viewBtn.addEventListener("click", () => previewSavedItem(item));

            const removeBtn = document.createElement("button");
            removeBtn.className = "ghost-btn";
            removeBtn.type = "button";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", () => removeSavedItem(item.id));

            actions.appendChild(viewBtn);
            actions.appendChild(removeBtn);
            elements.savedList.appendChild(wrapper);
        });
    }

    function previewSavedItem(item) {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d").drawImage(image, 0, 0);
            state.currentCanvas = canvas;
            state.filename = item.filename;
            elements.finalCanvasWrapper.innerHTML = "";
            elements.finalCanvasWrapper.classList.remove("empty");
            elements.finalCanvasWrapper.appendChild(canvas);
            elements.qrFilename.textContent = item.filename;
            showBanner("success", "Loaded saved QR preview.");
        };
        image.src = item.dataUrl;
    }

    function removeSavedItem(id) {
        state.savedItems = state.savedItems.filter((item) => item.id !== id);
        persistSavedItems();
        renderSavedItems();
    }

    function clearSavedItems() {
        state.savedItems = [];
        persistSavedItems();
        renderSavedItems();
        showBanner("success", "Saved QR library cleared.");
    }

    function resetActiveModeFields() {
        switch (state.mode) {
            case "url":
                elements.inputs.url.value = "";
                break;
            case "text":
                elements.inputs.text.value = "";
                break;
            case "wifi":
                elements.inputs.ssid.value = "";
                elements.inputs.password.value = "";
                elements.inputs.hidden.checked = false;
                elements.inputs.encryption.value = "WPA";
                elements.inputs.password.disabled = false;
                break;
            case "contact":
                elements.inputs.name.value = "";
                elements.inputs.phone.value = "";
                break;
            case "email":
                elements.inputs.emailTo.value = "";
                elements.inputs.emailSubject.value = "";
                elements.inputs.emailBody.value = "";
                break;
            case "secure":
                elements.inputs.secureMessage.value = "";
                elements.inputs.secureCode.value = "";
                elements.inputs.secureHint.value = "";
                break;
        }
        elements.customLabelInput.value = "";
        clearFieldErrors();
        clearBanner();
        requestGenerate();
    }

    async function downloadCurrentQr() {
        if (!state.currentCanvas) {
            showBanner("error", "Generate a QR code before downloading.");
            return;
        }
        const link = document.createElement("a");
        link.href = state.currentCanvas.toDataURL("image/png");
        link.download = state.filename;
        link.click();
    }

    async function copyCurrentQr() {
        if (!state.currentCanvas) {
            showBanner("error", "Generate a QR code before copying.");
            return;
        }
        if (!navigator.clipboard || !window.ClipboardItem) {
            showBanner("error", "Image copy is not supported in this browser.");
            return;
        }
        try {
            const blob = await canvasToBlob(state.currentCanvas);
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showBanner("success", "QR image copied to clipboard.");
        } catch (_) {
            showBanner("error", "Clipboard copy failed in this browser.");
        }
    }

    async function shareCurrentQr() {
        if (!state.currentCanvas) {
            showBanner("error", "Generate a QR code before sharing.");
            return;
        }
        if (!navigator.share) {
            showBanner("error", "Sharing is not supported in this browser.");
            return;
        }
        try {
            const blob = await canvasToBlob(state.currentCanvas);
            const file = new File([blob], state.filename, { type: "image/png" });
            const shareTitle = "QR Code";
            const shareText = state.filename.replace(/\.png$/i, "");
            const shareUrl = getShareUrl();

            if (shouldTryFileShare(file)) {
                try {
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        files: [file]
                    });
                    return;
                } catch (error) {
                    if (!isFileShareFallbackError(error)) {
                        throw error;
                    }
                }
            }

            await navigator.share({
                title: shareTitle,
                text: `${shareText} ${shareUrl}`.trim(),
                url: shareUrl
            });
        } catch (error) {
            if (error && error.name !== "AbortError") {
                showBanner("error", "Share failed in this browser.");
            }
        }
    }

    async function handleSecureUpload(event) {
        const file = event.target.files && event.target.files[0];
        elements.decryptedMessageCard.classList.add("hidden");
        elements.decryptedMessageOutput.textContent = "";
        elements.secureDecodeStatus.textContent = "";

        if (!file) {
            return;
        }

        try {
            const qrText = await decodeQrFromFile(file);
            if (!qrText) {
                elements.secureDecodeStatus.textContent = "No QR code was detected in that image.";
                return;
            }
            if (!isProtectedQrValue(qrText)) {
                elements.secureDecodeStatus.textContent = "This QR code is not a protected myqrs.me code.";
                return;
            }

            state.pendingSecurePayload = parseSecurePayload(qrText);
            elements.unlockHint.textContent = state.pendingSecurePayload.hint
                ? `Hint: ${state.pendingSecurePayload.hint}`
                : "Enter the code used when this protected QR was created.";
            openUnlockDialog();
            elements.secureDecodeStatus.textContent = "Protected QR detected. Enter the code to unlock the message.";
        } catch (error) {
            elements.secureDecodeStatus.textContent = error.message || "Could not decode that QR image.";
        } finally {
            elements.secureQrUpload.value = "";
        }
    }

    async function handleUnlockSubmit(event) {
        event.preventDefault();
        elements.unlockError.textContent = "";

        if (!state.pendingSecurePayload) {
            elements.unlockError.textContent = "No protected payload is loaded.";
            return;
        }

        try {
            const code = elements.unlockCodeInput.value;
            const decrypted = await decryptSecurePayload(state.pendingSecurePayload, code);
            elements.decryptedMessageOutput.textContent = decrypted;
            elements.decryptedMessageCard.classList.remove("hidden");
            closeUnlockDialog();
            showBanner("success", "Encrypted message unlocked.");
        } catch (_) {
            elements.unlockError.textContent = "Incorrect code or corrupted protected QR.";
        }
    }

    function openUnlockDialog() {
        if (typeof elements.unlockDialog.showModal === "function") {
            elements.unlockDialog.showModal();
        } else {
            elements.unlockDialog.setAttribute("open", "open");
        }
        elements.unlockCodeInput.focus();
    }

    function closeUnlockDialog() {
        if (typeof elements.unlockDialog.close === "function") {
            elements.unlockDialog.close();
        } else {
            elements.unlockDialog.removeAttribute("open");
            resetUnlockDialog();
        }
    }

    function resetUnlockDialog() {
        elements.unlockCodeInput.value = "";
        elements.unlockError.textContent = "";
    }

    async function decodeQrFromFile(file) {
        const image = await fileToImage(file);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
        });

        if (decoded && decoded.data) {
            return decoded.data;
        }

        if ("BarcodeDetector" in window) {
            const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
            const result = await detector.detect(canvas);
            if (result[0] && result[0].rawValue) {
                return result[0].rawValue;
            }
        }

        return "";
    }

    async function buildSecurePayload(message, code, hint) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveAesKey(code, salt);
        const encoded = new TextEncoder().encode(message);
        const compressed = await compressBytes(encoded);
        const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, compressed);
        const hintBytes = new TextEncoder().encode(hint).slice(0, 1024);
        const cipherBytes = new Uint8Array(cipherBuffer);
        const flags = compressed.length !== encoded.length ? 1 : 0;
        const payloadBytes = new Uint8Array(4 + salt.length + iv.length + hintBytes.length + cipherBytes.length);
        let offset = 0;

        payloadBytes[offset++] = 1;
        payloadBytes[offset++] = flags;
        payloadBytes[offset++] = (hintBytes.length >> 8) & 255;
        payloadBytes[offset++] = hintBytes.length & 255;
        payloadBytes.set(salt, offset);
        offset += salt.length;
        payloadBytes.set(iv, offset);
        offset += iv.length;
        payloadBytes.set(hintBytes, offset);
        offset += hintBytes.length;
        payloadBytes.set(cipherBytes, offset);

        return buildUnlockUrl(payloadBytes);
    }

    function parseSecurePayload(rawText) {
        const encoded = rawText.startsWith(SECURE_PREFIX)
            ? rawText.slice(SECURE_PREFIX.length)
            : getHashValue(rawText);
        const payloadBytes = base64ToBytes(encoded);

        if (payloadBytes[0] === 123) {
            const legacyJson = new TextDecoder().decode(payloadBytes);
            const legacyPayload = JSON.parse(legacyJson);
            return {
                hint: legacyPayload.hint || "",
                zip: Boolean(legacyPayload.zip),
                salt: base64ToBytes(legacyPayload.salt),
                iv: base64ToBytes(legacyPayload.iv),
                data: base64ToBytes(legacyPayload.data)
            };
        }

        return parseCompactSecurePayload(payloadBytes);
    }

    async function decryptSecurePayload(payload, code) {
        const key = await deriveAesKey(code, payload.salt);
        const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.iv }, key, payload.data);
        const plainBytes = new Uint8Array(plainBuffer);
        const normalized = payload.zip ? await decompressBytes(plainBytes) : plainBytes;
        return new TextDecoder().decode(normalized);
    }

    async function deriveAesKey(code, salt) {
        const material = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(code),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 120000,
                hash: "SHA-256"
            },
            material,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    function hydrateSecurePayloadFromUrl() {
        if (!location.hash.startsWith("#unlock=")) {
            return;
        }
        try {
            state.pendingSecurePayload = parseSecurePayload(location.hash);
            elements.unlockHint.textContent = state.pendingSecurePayload.hint
                ? `Hint: ${state.pendingSecurePayload.hint}`
                : "Enter the code used when this protected QR was created.";
            elements.secureDecodeStatus.textContent = "Protected link detected. Enter the code to unlock the message.";
            openUnlockDialog();
        } catch (_) {
            elements.secureDecodeStatus.textContent = "Protected link data is invalid.";
        }
    }

    function isProtectedQrValue(value) {
        return value.startsWith(SECURE_PREFIX) || value.includes("#unlock=");
    }

    function buildUnlockUrl(payloadBytes) {
        const baseUrl = getBaseUnlockUrl();
        const encodedPayload = toBase64Url(bytesToBase64(payloadBytes));
        return `${baseUrl}#unlock=${encodedPayload}`;
    }

    function getShareUrl() {
        if (/^https?:/i.test(location.href)) {
            return location.href;
        }
        return getBaseUnlockUrl();
    }

    function getBaseUnlockUrl() {
        if (/^https?:/i.test(location.href)) {
            return `${location.origin}${location.pathname}`;
        }
        return "https://myqrs.me/";
    }

    function getHashValue(value) {
        const rawHash = value.startsWith("#") ? value.slice(1) : value.split("#")[1] || "";
        const params = new URLSearchParams(rawHash);
        const unlockValue = params.get("unlock");
        if (!unlockValue) {
            throw new Error("Missing unlock payload.");
        }
        return fromBase64Url(unlockValue);
    }

    function getQrCorrectionLevel(text) {
        return QRCode.CorrectLevel.L;
    }

    function parseCompactSecurePayload(payloadBytes) {
        const version = payloadBytes[0];
        const flags = payloadBytes[1];
        const hintLength = (payloadBytes[2] << 8) | payloadBytes[3];

        if (version !== 1) {
            throw new Error("Unsupported protected payload version.");
        }

        const saltStart = 4;
        const saltEnd = saltStart + 16;
        const ivEnd = saltEnd + 12;
        const hintEnd = ivEnd + hintLength;

        if (payloadBytes.length <= hintEnd) {
            throw new Error("Protected payload is corrupted.");
        }

        return {
            hint: new TextDecoder().decode(payloadBytes.slice(ivEnd, hintEnd)),
            zip: Boolean(flags & 1),
            salt: payloadBytes.slice(saltStart, saltEnd),
            iv: payloadBytes.slice(saltEnd, ivEnd),
            data: payloadBytes.slice(hintEnd)
        };
    }

    async function compressBytes(bytes) {
        if (typeof CompressionStream !== "function") {
            return bytes;
        }
        try {
            const stream = new CompressionStream("gzip");
            const writer = stream.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const compressed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
            return compressed.length < bytes.length ? compressed : bytes;
        } catch (_) {
            return bytes;
        }
    }

    function canShareFiles(file) {
        if (!navigator.share || typeof navigator.canShare !== "function") {
            return false;
        }
        try {
            return navigator.canShare({ files: [file] });
        } catch (_) {
            return false;
        }
    }

    function shouldTryFileShare(file) {
        if (!navigator.share) {
            return false;
        }
        if (typeof navigator.canShare === "function") {
            return canShareFiles(file);
        }
        return true;
    }

    function isFileShareFallbackError(error) {
        return Boolean(error) && (error.name === "TypeError" || error.name === "DataError" || error.name === "NotSupportedError");
    }

    function updateShareAvailability() {
        const supported = Boolean(navigator.share);
        const mode = getPreferredShareMode();
        elements.shareBtn.disabled = !supported;
        elements.shareBtn.hidden = !supported;
        elements.shareBtn.title = supported ? "" : "Share is not supported in this browser.";
        elements.shareBtn.textContent = mode;
    }

    function getPreferredShareMode() {
        if (!navigator.share) {
            return "Share";
        }
        if (typeof navigator.canShare === "function") {
            const testFile = new File(["qr"], "qrcode.png", { type: "image/png" });
            return canShareFiles(testFile) ? "Share PNG" : "Share Link";
        }
        return "Share";
    }

    async function decompressBytes(bytes) {
        if (typeof DecompressionStream !== "function") {
            return bytes;
        }
        const stream = new DecompressionStream("gzip");
        const writer = stream.writable.getWriter();
        writer.write(bytes);
        writer.close();
        return new Uint8Array(await new Response(stream.readable).arrayBuffer());
    }

    function resolveLabel(defaultLabel) {
        if (!state.showLabel) {
            return "";
        }
        const candidate = elements.customLabelInput.value.trim() || defaultLabel;
        return candidate.slice(0, 34);
    }

    function getDefaultLabel() {
        switch (state.mode) {
            case "url":
                return extractLabelFromUrl(normalizeUrl(elements.inputs.url.value.trim()));
            case "text":
                return "Text";
            case "wifi":
                return elements.inputs.ssid.value.trim() || "WiFi";
            case "contact":
                return elements.inputs.name.value.trim() || "Contact";
            case "email":
                return elements.inputs.emailTo.value.trim() ? `Email ${elements.inputs.emailTo.value.trim()}` : "Email";
            case "secure":
                return elements.inputs.secureHint.value.trim() || "Protected QR";
            default:
                return "QR Code";
        }
    }

    function syncLabelToggle() {
        elements.showLabelToggle.classList.toggle("is-on", state.showLabel);
        elements.showLabelToggle.setAttribute("aria-checked", String(state.showLabel));
        elements.customLabelSection.classList.toggle("hidden", !state.showLabel);
    }

    function normalizeUrl(value) {
        if (!value) {
            return value;
        }
        if (/^[a-zA-Z]+:/.test(value)) {
            return value;
        }
        return `https://${value}`;
    }

    function extractLabelFromUrl(value) {
        try {
            const host = new URL(value).hostname.replace(/^www\./i, "");
            return host || "Website";
        } catch (_) {
            return "Website";
        }
    }

    function escapeWifiString(str) {
        return str.replace(/([\\;,:"])/g, "\\$1");
    }

    function debounce(fn, wait) {
        let timeoutId = 0;
        return function debounced() {
            const args = arguments;
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => fn.apply(null, args), wait);
        };
    }

    function slugify(value) {
        return (value || "qrcode")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || "qrcode";
    }

    function formatDate(value) {
        try {
            return new Date(value).toLocaleString();
        } catch (_) {
            return value;
        }
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas export failed."));
                }
            }, "image/png");
        });
    }

    function fileToImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error("Image could not be read."));
                image.src = reader.result;
            };
            reader.onerror = () => reject(new Error("File could not be read."));
            reader.readAsDataURL(file);
        });
    }

    function bytesToBase64(bytes) {
        let binary = "";
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function toBase64Url(base64) {
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function fromBase64Url(value) {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
        return normalized + padding;
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    init();
}());
