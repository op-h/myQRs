(function () {
    "use strict";

    const QR_SIZE = 300;
    const MODE_DETAILS = {
        url: {
            badge: "URL MODE",
            summary: "Create scannable website links with automatic protocol normalization.",
            preview: "Website QR ready for preview, export, and account saving."
        },
        text: {
            badge: "TEXT MODE",
            summary: "Encode notes, short instructions, or compact text payloads into a QR.",
            preview: "Text QR rendered for quick sharing and download."
        },
        wifi: {
            badge: "WIFI MODE",
            summary: "Generate WiFi join codes with SSID, password, and visibility settings.",
            preview: "WiFi QR generated for one-scan network onboarding."
        },
        contact: {
            badge: "CONTACT MODE",
            summary: "Create a contact QR using a compact vCard payload.",
            preview: "Contact QR ready for device import and sharing."
        },
        email: {
            badge: "EMAIL MODE",
            summary: "Generate a mailto QR with recipient, subject, and message body.",
            preview: "Email QR prepared for export and later reuse."
        },
        secure: {
            badge: "PROTECTED MODE",
            summary: "Encrypt a private message, save it immediately, and generate a QR that opens the unlock route first.",
            preview: "Protected QR points to the secure unlock route for this app."
        }
    };

    const state = {
        user: null,
        items: [],
        currentMode: "url",
        currentCanvas: null,
        currentPayload: null,
        sharedPayload: null,
        renderToken: 0
    };

    const elements = {
        authView: document.getElementById("authView"),
        appView: document.getElementById("appView"),
        publicUnlockView: document.getElementById("publicUnlockView"),
        authTabs: Array.from(document.querySelectorAll("[data-auth-tab]")),
        authAlert: document.getElementById("authAlert"),
        appAlert: document.getElementById("appAlert"),
        loginForm: document.getElementById("loginForm"),
        registerForm: document.getElementById("registerForm"),
        logoutBtn: document.getElementById("logoutBtn"),
        userName: document.getElementById("userName"),
        userEmail: document.getElementById("userEmail"),
        modeButtons: Array.from(document.querySelectorAll("[data-mode]")),
        modeSections: Array.from(document.querySelectorAll("[data-section]")),
        modeSummary: document.getElementById("modeSummary"),
        modeBadge: document.getElementById("modeBadge"),
        qrForm: document.getElementById("qrForm"),
        generateBtn: document.getElementById("generateBtn"),
        saveBtn: document.getElementById("saveBtn"),
        clearFormBtn: document.getElementById("clearFormBtn"),
        secureStatus: document.getElementById("secureStatus"),
        qrcode: document.getElementById("qrcode"),
        previewFrame: document.getElementById("previewFrame"),
        previewEmpty: document.getElementById("previewEmpty"),
        previewTitle: document.getElementById("previewTitle"),
        previewMeta: document.getElementById("previewMeta"),
        previewLinkWrap: document.getElementById("previewLinkWrap"),
        previewLinkText: document.getElementById("previewLinkText"),
        copyLinkBtn: document.getElementById("copyLinkBtn"),
        downloadBtn: document.getElementById("downloadBtn"),
        copyBtn: document.getElementById("copyBtn"),
        shareBtn: document.getElementById("shareBtn"),
        shareHelp: document.getElementById("shareHelp"),
        libraryGrid: document.getElementById("libraryGrid"),
        libraryCount: document.getElementById("libraryCount"),
        statTotal: document.getElementById("statTotal"),
        statProtected: document.getElementById("statProtected"),
        statFavorites: document.getElementById("statFavorites"),
        publicUnlockForm: document.getElementById("publicUnlockForm"),
        publicUnlockCode: document.getElementById("publicUnlockCode"),
        publicUnlockHint: document.getElementById("publicUnlockHint"),
        publicUnlockIntro: document.getElementById("publicUnlockIntro"),
        publicUnlockError: document.getElementById("publicUnlockError"),
        publicUnlockResult: document.getElementById("publicUnlockResult"),
        inputs: {
            loginEmail: document.getElementById("loginEmail"),
            loginPassword: document.getElementById("loginPassword"),
            registerName: document.getElementById("registerName"),
            registerEmail: document.getElementById("registerEmail"),
            registerPassword: document.getElementById("registerPassword"),
            title: document.getElementById("titleInput"),
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
            secureHint: document.getElementById("secureHintInput"),
            customLabel: document.getElementById("customLabelInput"),
            favorite: document.getElementById("favoriteCheckbox")
        }
    };

    document.addEventListener("DOMContentLoaded", init);

    async function init() {
        bindEvents();
        clearPreview();
        switchMode("url");

        if (isSharedRoute()) {
            await loadSharedPayload();
            return;
        }

        await hydrateSession();
    }

    function bindEvents() {
        elements.authTabs.forEach((button) => {
            button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
        });

        elements.loginForm.addEventListener("submit", handleLogin);
        elements.registerForm.addEventListener("submit", handleRegister);
        elements.logoutBtn.addEventListener("click", handleLogout);

        elements.modeButtons.forEach((button) => {
            button.addEventListener("click", () => switchMode(button.dataset.mode));
        });

        elements.qrForm.addEventListener("submit", handleGenerate);
        elements.saveBtn.addEventListener("click", handleSave);
        elements.clearFormBtn.addEventListener("click", resetForm);

        elements.downloadBtn.addEventListener("click", downloadCurrentQr);
        elements.copyBtn.addEventListener("click", copyCurrentQr);
        elements.copyLinkBtn.addEventListener("click", copyPreviewLink);
        elements.shareBtn.addEventListener("click", shareCurrentQr);

        elements.publicUnlockForm.addEventListener("submit", handlePublicUnlock);

        window.addEventListener("resize", updateActionState);
    }

    async function hydrateSession() {
        try {
            const data = await fetchJson("/api/auth/me");
            state.user = data.user;
            showApp();
            await refreshLibrary();
        } catch (_) {
            showAuth();
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        clearAlert(elements.authAlert);

        try {
            const data = await fetchJson("/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: elements.inputs.loginEmail.value.trim(),
                    password: elements.inputs.loginPassword.value
                })
            });

            state.user = data.user;
            showApp();
            await refreshLibrary();
            resetForm();
        } catch (error) {
            showAlert(elements.authAlert, error.message, "danger");
        }
    }

    async function handleRegister(event) {
        event.preventDefault();
        clearAlert(elements.authAlert);

        try {
            const data = await fetchJson("/api/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    name: elements.inputs.registerName.value.trim(),
                    email: elements.inputs.registerEmail.value.trim(),
                    password: elements.inputs.registerPassword.value
                })
            });

            state.user = data.user;
            showApp();
            await refreshLibrary();
            resetForm();
        } catch (error) {
            showAlert(elements.authAlert, error.message, "danger");
        }
    }

    async function handleLogout() {
        try {
            await fetchJson("/api/auth/logout", { method: "POST" });
        } catch (_) {
            // The session may already be invalid. Continue resetting local state.
        }

        state.user = null;
        state.items = [];
        resetForm();
        showAuth();
    }

    function switchAuthTab(tab) {
        elements.authTabs.forEach((button) => {
            button.classList.toggle("active", button.dataset.authTab === tab);
        });
        elements.loginForm.classList.toggle("d-none", tab !== "login");
        elements.registerForm.classList.toggle("d-none", tab !== "register");
        clearAlert(elements.authAlert);
    }

    function switchMode(mode) {
        state.currentMode = mode;

        elements.modeButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.mode === mode);
        });

        elements.modeSections.forEach((section) => {
            section.classList.toggle("d-none", section.dataset.section !== mode);
        });

        const details = MODE_DETAILS[mode] || MODE_DETAILS.url;
        elements.modeSummary.textContent = details.summary;
        elements.modeBadge.textContent = details.badge;
        elements.generateBtn.textContent = mode === "secure" ? "Create Protected QR" : "Generate Preview";
        elements.saveBtn.disabled = mode === "secure";
        elements.saveBtn.textContent = mode === "secure" ? "Saved during creation" : "Save To Library";

        if (elements.secureStatus) {
            elements.secureStatus.textContent = mode === "secure"
                ? "Protected mode creates an encrypted record first, then renders the secure route as the QR payload."
                : "Standard modes render locally first so you can preview before saving.";
        }
    }

    async function handleGenerate(event) {
        event.preventDefault();
        clearAlert(elements.appAlert);

        try {
            if (state.currentMode === "secure") {
                setBusy(elements.generateBtn, true, "Creating...");
                const item = await createSecureItem();
                state.currentPayload = item;
                renderPreviewFromItem(item);
                showAlert(elements.appAlert, "Protected QR created, saved, and linked to the secure unlock route.", "success");
                await refreshLibrary();
                return;
            }

            const item = buildPlainQrData();
            state.currentPayload = item;
            renderPreviewFromItem(item);
        } catch (error) {
            showAlert(elements.appAlert, error.message, "danger");
        } finally {
            setBusy(elements.generateBtn, false, state.currentMode === "secure" ? "Create Protected QR" : "Generate Preview");
        }
    }

    async function handleSave() {
        clearAlert(elements.appAlert);

        try {
            setBusy(elements.saveBtn, true, "Saving...");
            const item = state.currentPayload || buildPlainQrData();
            const data = await fetchJson("/api/qrs", {
                method: "POST",
                body: JSON.stringify({
                    title: item.title,
                    type: item.type,
                    label: item.label,
                    payload: item.payload,
                    options: { ...item.options, favorite: Boolean(elements.inputs.favorite.checked) }
                })
            });

            state.currentPayload = data.item;
            renderPreviewFromItem(data.item);
            showAlert(elements.appAlert, "QR saved to your library.", "success");
            await refreshLibrary();
        } catch (error) {
            showAlert(elements.appAlert, error.message, "danger");
        } finally {
            setBusy(elements.saveBtn, false, "Save To Library");
        }
    }

    function buildPlainQrData() {
        const title = elements.inputs.title.value.trim() || defaultTitle();
        const label = elements.inputs.customLabel.value.trim();
        const options = {};
        let payload = "";

        switch (state.currentMode) {
            case "url":
                payload = normalizeUrl(elements.inputs.url.value.trim());
                if (!payload) {
                    throw new Error("Enter a valid URL.");
                }
                break;
            case "text":
                payload = elements.inputs.text.value.trim();
                if (!payload) {
                    throw new Error("Enter text content.");
                }
                break;
            case "wifi": {
                const ssid = elements.inputs.ssid.value.trim();
                if (!ssid) {
                    throw new Error("Network name is required.");
                }
                payload = `WIFI:T:${elements.inputs.encryption.value};S:${escapeWifiString(ssid)};P:${escapeWifiString(elements.inputs.password.value)};H:${elements.inputs.hidden.checked ? "true" : "false"};;`;
                options.ssid = ssid;
                break;
            }
            case "contact": {
                const name = elements.inputs.name.value.trim();
                const phone = elements.inputs.phone.value.trim();
                if (!name || !phone) {
                    throw new Error("Name and phone are required.");
                }
                payload = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL,VOICE:${phone}\nEND:VCARD`;
                break;
            }
            case "email": {
                const email = elements.inputs.emailTo.value.trim();
                if (!email) {
                    throw new Error("Recipient email is required.");
                }
                payload = `mailto:${email}?subject=${encodeURIComponent(elements.inputs.emailSubject.value.trim())}&body=${encodeURIComponent(elements.inputs.emailBody.value)}`;
                break;
            }
            default:
                throw new Error("Unsupported mode.");
        }

        return {
            title,
            type: state.currentMode,
            label,
            payload,
            options
        };
    }

    async function createSecureItem() {
        const message = elements.inputs.secureMessage.value;
        const code = elements.inputs.secureCode.value;
        const hint = elements.inputs.secureHint.value.trim();

        if (!message.trim()) {
            throw new Error("Secret message is required.");
        }
        if (code.length < 4) {
            throw new Error("Pass code must be at least 4 characters.");
        }

        const encrypted = await encryptSecurePayload(message, code);
        const title = elements.inputs.title.value.trim() || "Protected QR";

        const data = await fetchJson("/api/qrs", {
            method: "POST",
            body: JSON.stringify({
                title,
                type: "secure",
                label: elements.inputs.customLabel.value.trim(),
                options: { favorite: Boolean(elements.inputs.favorite.checked) },
                secure: {
                    hint,
                    salt: encrypted.salt,
                    iv: encrypted.iv,
                    data: encrypted.data,
                    zip: false
                }
            })
        });

        if (!data.item || !(data.item.shareUrl || data.item.payload)) {
            throw new Error("Protected QR was saved, but the secure link could not be generated.");
        }

        return data.item;
    }

    async function refreshLibrary() {
        const data = await fetchJson("/api/qrs");
        state.items = data.items;
        renderStats(data.stats);
        renderLibrary();
    }

    function renderStats(stats) {
        elements.statTotal.textContent = stats.total || 0;
        elements.statProtected.textContent = stats.protected || 0;
        elements.statFavorites.textContent = stats.favorites || 0;
    }

    function renderLibrary() {
        elements.libraryGrid.innerHTML = "";
        elements.libraryCount.textContent = `${state.items.length} item${state.items.length === 1 ? "" : "s"}`;

        if (!state.items.length) {
            elements.libraryGrid.innerHTML = `
                <div class="col-12">
                    <article class="library-card text-center">
                        <h4 class="h5">No saved QR items yet</h4>
                        <p class="library-meta mb-0">Generate and save a QR to start building your account library.</p>
                    </article>
                </div>
            `;
            return;
        }

        state.items.forEach((item) => {
            const column = document.createElement("div");
            column.className = "col-md-6 col-xxl-4";
            column.innerHTML = `
                <article class="library-card">
                    <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
                        <div>
                            <h4 class="h5">${escapeHtml(item.title)}</h4>
                            <div class="library-meta">${escapeHtml(item.type.toUpperCase())} · ${new Date(item.createdAt).toLocaleString()}</div>
                        </div>
                        <span class="badge ${item.isFavorite ? "text-bg-success" : "text-bg-dark"}">${item.isFavorite ? "Favorite" : "Saved"}</span>
                    </div>
                    <p class="library-meta mb-3">${escapeHtml(buildLibraryDescription(item))}</p>
                    <div class="d-grid gap-2">
                        <button class="btn btn-accent btn-sm" data-action="preview" data-id="${item.id}">Preview</button>
                        <button class="btn btn-ghost btn-sm" data-action="favorite" data-id="${item.id}">${item.isFavorite ? "Remove Favorite" : "Add Favorite"}</button>
                        ${item.shareUrl ? `<button class="btn btn-ghost btn-sm" data-action="copy-link" data-link="${escapeAttribute(item.shareUrl)}">Copy Secure Link</button>` : ""}
                        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${item.id}">Delete</button>
                    </div>
                </article>
            `;
            elements.libraryGrid.appendChild(column);
        });

        elements.libraryGrid.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", async () => {
                const action = button.dataset.action;
                const id = button.dataset.id;

                try {
                    if (action === "preview") {
                        const item = state.items.find((entry) => entry.id === id);
                        if (!item) {
                            return;
                        }
                        state.currentPayload = item;
                        renderPreviewFromItem(item);
                        clearAlert(elements.appAlert);
                    }

                    if (action === "favorite") {
                        await fetchJson(`/api/qrs/${id}/favorite`, { method: "PATCH" });
                        await refreshLibrary();
                    }

                    if (action === "copy-link") {
                        await copyText(button.dataset.link);
                        showAlert(elements.appAlert, "Secure link copied.", "success");
                    }

                    if (action === "delete") {
                        await fetchJson(`/api/qrs/${id}`, { method: "DELETE" });
                        if (state.currentPayload && state.currentPayload.id === id) {
                            clearPreview();
                        }
                        await refreshLibrary();
                        showAlert(elements.appAlert, "QR item deleted.", "success");
                    }
                } catch (error) {
                    showAlert(elements.appAlert, error.message, "danger");
                }
            });
        });
    }

    function renderPreviewFromItem(item) {
        const payload = item.shareUrl || item.payload;
        if (!payload) {
            throw new Error("This QR item has no usable payload.");
        }

        renderPreviewCanvas(payload, item.label || item.title);

        const details = MODE_DETAILS[item.type] || MODE_DETAILS[state.currentMode] || MODE_DETAILS.url;
        elements.previewTitle.textContent = item.label || item.title || "QR ready";
        elements.previewMeta.textContent = item.type === "secure"
            ? `Protected link ready. Scanning opens ${shortUrlText(item.shareUrl || payload)} and then asks for the pass code.`
            : details.preview;

        if (item.shareUrl) {
            elements.previewLinkText.textContent = item.shareUrl;
            elements.previewLinkWrap.classList.remove("d-none");
        } else {
            elements.previewLinkText.textContent = "";
            elements.previewLinkWrap.classList.add("d-none");
        }

        updateActionState();
    }

    function renderPreviewCanvas(payload, label) {
        state.renderToken += 1;
        const renderToken = state.renderToken;
        elements.qrcode.innerHTML = "";

        try {
            new QRCode(elements.qrcode, {
                text: payload,
                width: QR_SIZE,
                height: QR_SIZE,
                colorDark: "#04110b",
                colorLight: "#ffffff",
                correctLevel: payload.length > 512 ? QRCode.CorrectLevel.L : QRCode.CorrectLevel.M
            });
        } catch (error) {
            throw new Error("The QR payload is too large for a single code. Shorten the content or use a shorter link.");
        }

        window.setTimeout(() => {
            if (renderToken !== state.renderToken) {
                return;
            }

            const source = elements.qrcode.querySelector("canvas") || elements.qrcode.querySelector("img");
            if (!source) {
                showAlert(elements.appAlert, "Failed to render the QR preview.", "danger");
                clearPreview();
                return;
            }

            const finalCanvas = document.createElement("canvas");
            const textLabel = String(label || "").trim();
            const labelHeight = textLabel ? 44 : 0;
            finalCanvas.width = QR_SIZE;
            finalCanvas.height = QR_SIZE + labelHeight;

            const context = finalCanvas.getContext("2d");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            context.drawImage(source, 0, 0, QR_SIZE, QR_SIZE);

            if (textLabel) {
                context.fillStyle = "#04110b";
                context.font = "600 16px Segoe UI, sans-serif";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(textLabel.slice(0, 34), finalCanvas.width / 2, QR_SIZE + 22);
            }

            state.currentCanvas = finalCanvas;
            elements.previewEmpty.classList.add("d-none");
            elements.qrcode.classList.remove("d-none");
            elements.qrcode.innerHTML = "";
            elements.qrcode.appendChild(finalCanvas);
            updateActionState();
        }, 80);
    }

    function clearPreview() {
        state.renderToken += 1;
        state.currentCanvas = null;
        state.currentPayload = null;
        elements.qrcode.innerHTML = "";
        elements.qrcode.classList.add("d-none");
        elements.previewEmpty.classList.remove("d-none");
        elements.previewTitle.textContent = "Nothing generated yet";
        elements.previewMeta.textContent = "Generate a preview, then download, copy, or share it.";
        elements.previewLinkText.textContent = "";
        elements.previewLinkWrap.classList.add("d-none");
        updateActionState();
    }

    function resetForm() {
        elements.qrForm.reset();
        clearAlert(elements.appAlert);
        clearPreview();
        switchMode("url");
    }

    async function downloadCurrentQr() {
        if (!state.currentCanvas) {
            showAlert(elements.appAlert, "Generate a QR first.", "danger");
            return;
        }

        const link = document.createElement("a");
        link.href = state.currentCanvas.toDataURL("image/png");
        link.download = `${slugify((state.currentPayload && state.currentPayload.title) || "myqrs") || "myqrs"}.png`;
        link.click();
    }

    async function copyCurrentQr() {
        if (!state.currentCanvas || !navigator.clipboard || !window.ClipboardItem) {
            showAlert(elements.appAlert, "Image copy is not supported in this browser.", "danger");
            return;
        }

        try {
            const blob = await canvasToBlob(state.currentCanvas);
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showAlert(elements.appAlert, "QR image copied.", "success");
        } catch (error) {
            showAlert(elements.appAlert, error.message || "Failed to copy the QR image.", "danger");
        }
    }

    async function shareCurrentQr() {
        if (!state.currentCanvas || !navigator.share) {
            showAlert(elements.appAlert, "Share is not supported in this browser.", "danger");
            return;
        }

        const shareUrl = state.currentPayload && state.currentPayload.shareUrl ? state.currentPayload.shareUrl : location.href;
        const shareTitle = (state.currentPayload && state.currentPayload.title) || "myqrs.me";

        try {
            const blob = await canvasToBlob(state.currentCanvas);
            const file = new File([blob], `${slugify(shareTitle) || "myqrs"}.png`, { type: "image/png" });

            if (canProbablyShareFiles() && navigator.canShare({ files: [file] })) {
                await navigator.share({ title: shareTitle, text: "QR code generated by myqrs.me", files: [file] });
                return;
            }

            await navigator.share({ title: shareTitle, text: "Open the QR destination", url: shareUrl });
        } catch (error) {
            if (error && error.name !== "AbortError") {
                showAlert(elements.appAlert, "Share failed in this browser.", "danger");
            }
        }
    }

    async function copyPreviewLink() {
        if (!elements.previewLinkText.textContent) {
            showAlert(elements.appAlert, "No protected link is available for this preview.", "danger");
            return;
        }

        try {
            await copyText(elements.previewLinkText.textContent);
            showAlert(elements.appAlert, "Protected link copied.", "success");
        } catch (error) {
            showAlert(elements.appAlert, error.message, "danger");
        }
    }

    function updateActionState() {
        const hasCanvas = Boolean(state.currentCanvas);
        const hasShareLink = Boolean(state.currentPayload && state.currentPayload.shareUrl);
        const shareSupported = Boolean(navigator.share);

        elements.downloadBtn.disabled = !hasCanvas;
        elements.copyBtn.disabled = !hasCanvas || !(navigator.clipboard && window.ClipboardItem);
        elements.copyLinkBtn.disabled = !hasShareLink;

        if (!shareSupported || !hasCanvas) {
            elements.shareBtn.hidden = true;
        } else {
            elements.shareBtn.hidden = false;
            elements.shareBtn.textContent = hasShareLink || !canProbablyShareFiles() ? "Share Link" : "Share PNG";
        }

        if (!hasCanvas) {
            elements.shareHelp.textContent = "Share availability depends on browser support and HTTPS.";
            return;
        }

        if (!shareSupported) {
            elements.shareHelp.textContent = "This browser does not expose the Web Share API here. Download or copy the QR instead.";
            return;
        }

        if (!window.isSecureContext) {
            elements.shareHelp.textContent = "Share support is limited until the site is opened over HTTPS.";
            return;
        }

        elements.shareHelp.textContent = canProbablyShareFiles()
            ? "PNG sharing is available on supported browsers. Others will fall back to sharing the route or page link."
            : "This browser can share links, but PNG file sharing is limited here.";
    }

    async function loadSharedPayload() {
        showOnly(elements.publicUnlockView);
        const shareId = location.pathname.split("/").filter(Boolean).pop();

        try {
            const data = await fetchJson(`/api/shared/${shareId}`);
            state.sharedPayload = data;
            elements.publicUnlockIntro.textContent = data.title
                ? `Unlock "${data.title}" with the correct pass code.`
                : "Enter the code used when this protected QR was created.";

            if (data.hint) {
                elements.publicUnlockHint.textContent = `Hint: ${data.hint}`;
                elements.publicUnlockHint.classList.remove("d-none");
            }
        } catch (error) {
            elements.publicUnlockError.textContent = error.message;
            elements.publicUnlockError.classList.remove("d-none");
        }
    }

    async function handlePublicUnlock(event) {
        event.preventDefault();
        elements.publicUnlockError.classList.add("d-none");
        elements.publicUnlockResult.classList.add("d-none");

        if (!state.sharedPayload) {
            elements.publicUnlockError.textContent = "Protected QR data is unavailable.";
            elements.publicUnlockError.classList.remove("d-none");
            return;
        }

        try {
            const message = await decryptSharedPayload(state.sharedPayload, elements.publicUnlockCode.value);
            elements.publicUnlockResult.textContent = message;
            elements.publicUnlockResult.classList.remove("d-none");
        } catch (_) {
            elements.publicUnlockError.textContent = "Incorrect code or damaged encrypted payload.";
            elements.publicUnlockError.classList.remove("d-none");
        }
    }

    function showAuth() {
        showOnly(elements.authView);
        switchAuthTab("login");
    }

    function showApp() {
        showOnly(elements.appView);
        elements.userName.textContent = state.user.name;
        elements.userEmail.textContent = state.user.email;
        updateActionState();
    }

    function showOnly(target) {
        [elements.authView, elements.appView, elements.publicUnlockView].forEach((section) => {
            section.classList.toggle("d-none", section !== target);
        });
    }

    async function encryptSecurePayload(message, code) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(code, salt);
        const plaintext = new TextEncoder().encode(message);
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

        return {
            salt: bytesToBase64(salt),
            iv: bytesToBase64(iv),
            data: bytesToBase64(new Uint8Array(encrypted))
        };
    }

    async function decryptSharedPayload(payload, code) {
        const key = await deriveKey(code, base64ToBytes(payload.salt));
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
            key,
            base64ToBytes(payload.data)
        );
        return new TextDecoder().decode(decrypted);
    }

    async function deriveKey(code, salt) {
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

    async function fetchJson(url, options) {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "same-origin",
            ...options
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.message || "Request failed.");
        }
        return data;
    }

    function normalizeUrl(value) {
        if (!value) {
            return "";
        }

        if (/^[a-zA-Z]+:/.test(value)) {
            return value;
        }

        return `https://${value}`;
    }

    function defaultTitle() {
        switch (state.currentMode) {
            case "url":
                return "Website QR";
            case "text":
                return "Text QR";
            case "wifi":
                return "WiFi QR";
            case "contact":
                return "Contact QR";
            case "email":
                return "Email QR";
            case "secure":
                return "Protected QR";
            default:
                return "QR";
        }
    }

    function buildLibraryDescription(item) {
        if (item.type === "secure" && item.shareUrl) {
            return `Secure route: ${item.shareUrl}`;
        }

        return item.label || (item.payload || "").slice(0, 100) || "Stored in your account library";
    }

    function shortUrlText(value) {
        try {
            const url = new URL(value);
            return `${url.hostname}${url.pathname}`;
        } catch (_) {
            return value;
        }
    }

    function escapeWifiString(value) {
        return String(value || "").replace(/([\\;,:"])/g, "\\$1");
    }

    function showAlert(target, message, type) {
        target.className = `alert alert-${type}`;
        target.textContent = message;
        target.classList.remove("d-none");
    }

    function clearAlert(target) {
        target.className = "alert d-none";
        target.textContent = "";
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }

    async function copyText(value) {
        if (!navigator.clipboard) {
            throw new Error("Clipboard access is not supported in this browser.");
        }

        await navigator.clipboard.writeText(value);
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to create image blob."));
                }
            }, "image/png");
        });
    }

    function canProbablyShareFiles() {
        return Boolean(navigator.share && navigator.canShare && typeof File !== "undefined");
    }

    function setBusy(button, isBusy, busyText) {
        if (!button) {
            return;
        }

        if (isBusy) {
            button.dataset.originalText = button.textContent;
            button.disabled = true;
            button.textContent = busyText;
            return;
        }

        button.disabled = false;
        button.textContent = busyText || button.dataset.originalText || button.textContent;
        button.dataset.originalText = button.textContent;
    }

    function slugify(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48);
    }

    function bytesToBase64(bytes) {
        let binary = "";
        bytes.forEach((byte) => {
            binary += String.fromCharCode(byte);
        });
        return btoa(binary);
    }

    function base64ToBytes(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes;
    }

    function isSharedRoute() {
        return /^\/shared\/[^/]+/.test(location.pathname);
    }
}());
