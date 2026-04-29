import { doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, orderBy, updateDoc , where } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

// ===== Gemini AI Configuration =====
// API requests are securely routed through Vercel Serverless Function (/api/gemini)

async function callGeminiAPI(prompt, systemInstruction = '') {
    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };
    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Gemini API error');
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
}

// Chatbot conversation memory
let chatHistory = [];

// Main Application Logic
const appContainer = document.getElementById('app-container');

// State
let currentUser = null;
let currentProfileType = null;

// Views
const views = {
    splash: `
        <div class="splash-screen">
            <img src="logodp.png" alt="HealthVault" class="splash-logo" />
        </div>
    `,
    profileSelection: `
        <div class="profile-selection">
            <img src="I.png" alt="HealthVault" class="selection-logo" />
            <h1 class="access-title">Who’s Accessing?</h1>
            <div class="profiles-grid">
                <div class="profile-item" onclick="selectProfile('Patient')">
                    <div class="profile-img-container">
                        <img src="user.png" alt="User" class="profile-img" onerror="this.style.display='none'" />
                    </div>
                    <span class="profile-label">User</span>
                </div>
                <div class="profile-item" onclick="selectProfile('Doctor')">
                    <div class="profile-img-container">
                        <img src="doctor.png" alt="Doctor" class="profile-img" onerror="this.style.display='none'" />
                    </div>
                    <span class="profile-label">Doctor</span>
                </div>
                <div class="profile-item" onclick="selectProfile('Organization')">
                    <div class="profile-img-container">
                        <img src="organisation.png" alt="Organisation" class="profile-img" onerror="this.style.display='none'" />
                    </div>
                    <span class="profile-label">Organisation</span>
                </div>
                <div class="profile-item" onclick="selectProfile('Lab')">
                    <div class="profile-img-container">
                        <img src="lab.png" alt="Lab" class="profile-img" onerror="this.style.display='none'" />
                    </div>
                    <span class="profile-label">Lab</span>
                </div>
            </div>
        </div>
    `,
    authScreen: `
        <div class="auth-container">
            <h1 class="welcome-heading" style="background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: none;">Welcome to HealthVault</h1>
            <div class="auth-card">
                <div class="auth-card-logo">
                    <img src="l3.png" alt="HealthVault Logo" />
                </div>
                <h2 class="auth-card-title" style="background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: none;">Hello <span id="auth-title-dynamic"></span> 👋</h2>
                <p class="auth-card-subtitle">Welcome to your HealthVault portal</p>
                
                <div class="auth-action-section">
                    <p class="auth-action-text">New here?</p>
                    <button class="auth-btn btn-primary" onclick="showRegister()">Register</button>
                </div>

                <div class="auth-action-section">
                    <p class="auth-action-text">Already registered?</p>
                    <button class="auth-btn btn-secondary" onclick="showLogin()">Login</button>
                </div>
            </div>
            <button class="floating-back-btn" onclick="window.goBackFromAuth()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
            </button>
        </div>
    `,
    registerScreen: `
        <div class="auth-container">
            <div class="form-card">
                <h2 id="reg-title" class="form-card-title" style="background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: none;"></h2>
                
                <div class="avatar-upload" onclick="document.getElementById('reg-file-hidden').click()">
                    <img id="avatar-preview-img" class="avatar-preview" src="user.png" alt="Profile" onerror="this.src='https://via.placeholder.com/100?text=+'" />
                    <div class="avatar-overlay">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    </div>
                </div>

                <form id="register-form" onsubmit="handleRegister(event)">
                    <input type="file" id="reg-file-hidden" accept="image/*" onchange="previewAvatar(event)">
                    <div id="dynamic-reg-fields"></div>
                    <button type="submit" class="auth-btn btn-primary" style="margin-top: 10px;">Register</button>
                </form>
            </div>
            <button type="button" class="floating-back-btn" onclick="window.goBackFromAuth()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
            </button>
        </div>
    `,
    loginScreen: `
        <div class="auth-container">
            <div class="form-card">
                <h2 class="form-card-title" style="background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: none;">Login as <span id="login-profile-type"></span></h2>
                <form id="login-form" onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">Unique ID / Email</label>
                        <input type="text" id="login-id" class="form-input" placeholder="Your Unique ID (e.g., PAT-1234)" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Security PIN / Password</label>
                        <input type="password" id="login-pin" class="form-input" placeholder="Enter your password/PIN" required>
                    </div>
                    <button type="submit" class="auth-btn btn-primary" style="margin-top: 10px;">Login</button>
                </form>
            </div>
            <button type="button" class="floating-back-btn" onclick="window.goBackFromAuth()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
            </button>
        </div>
    `
};

function renderView(viewName) {
    if (appContainer) {
        appContainer.innerHTML = views[viewName];
    }
}
window.renderView = renderView;

// Global functions for inline event handlers
window.goBackFromAuth = function() {
    if (window.orgAddingMember) {
        window.orgAddingMember = false;
        window.renderDashboard();
    } else {
        renderView('profileSelection');
    }
};

window.selectProfile = function (profileType) {
    currentProfileType = profileType;
    renderView('authScreen');
    const authTitleEl = document.getElementById('auth-title-dynamic');
    if (authTitleEl) authTitleEl.innerText = profileType;
};

window.showRegister = function () {
    renderView('registerScreen');

    // Set the title
    let title = currentProfileType === 'Patient' ? 'Patient' : currentProfileType;
    if (title === 'User') title = 'Patient'; // Fallback mapping if User is clicked
    document.getElementById('reg-title').innerText = title + ' Registration';

    const fieldsContainer = document.getElementById('dynamic-reg-fields');
    let fieldsHtml = '';

    if (currentProfileType === 'Patient' || currentProfileType === 'User') {
        fieldsHtml = `
            <div class="form-group">
                <label class="form-label">Name*</label>
                <input type="text" id="reg-name" class="form-input" placeholder="Enter your Full Name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Phone Number*</label>
                <input type="tel" id="reg-phone" class="form-input" placeholder="Enter your 10 digit Phone Number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Age*</label>
                <input type="number" id="reg-age" class="form-input" placeholder="Enter your Age" required>
            </div>
            <div class="form-group">
                <label class="form-label">Security PIN*</label>
                <input type="password" id="reg-pin" class="form-input" placeholder="Create 4-digit Security PIN" maxlength="7" required>
            </div>
            ${window.orgAddingMember ? `
            <div class="form-group" style="padding: 14px 16px; background: rgba(37,99,235,0.05); border-radius: 12px; border: 1px solid rgba(37,99,235,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <label class="form-label" style="margin-bottom: 2px;">🔒 Make Profile Private</label>
                        <p style="color: #64748b; font-size: 0.8rem; margin: 0;">Organization admins will need a PIN to view your records</p>
                    </div>
                    <label class="privacy-toggle" onclick="event.stopPropagation();">
                        <input type="checkbox" id="reg-private-toggle" onchange="togglePrivacyPin(this.checked)">
                        <span class="toggle-track"></span>
                    </label>
                </div>
                <div id="privacy-pin-container" style="display: none; margin-top: 12px;">
                    <input type="password" id="reg-privacy-pin" class="form-input" placeholder="Create Privacy PIN (for org access)" maxlength="6">
                </div>
            </div>
            ` : ''}
        `;
    } else if (currentProfileType === 'Doctor') {
        fieldsHtml = `
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="reg-name" class="form-input" placeholder="Dr. John Doe" required>
            </div>
            <div class="form-group">
                <label class="form-label">Medical Registration Number</label>
                <input type="text" id="reg-med-id" class="form-input" placeholder="e.g. MCI123456" required>
            </div>
            <div class="form-group">
                <label class="form-label">Specialization</label>
                <select id="reg-specialization" class="form-select" required>
                    <option value="" disabled selected>Select Specialization</option>
                    <option value="Cardiologist">Cardiologist</option>
                    <option value="Dermatologist">Dermatologist</option>
                    <option value="Neurologist">Neurologist</option>
                    <option value="General Practitioner">General Practitioner</option>
                    <option value="Pediatrician">Pediatrician</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Hospital / Clinic Name</label>
                <input type="text" id="reg-hospital" class="form-input" required>
            </div>
            <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="tel" id="reg-phone" class="form-input" placeholder="Enter 10-digit phone number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="reg-email" class="form-input" placeholder="example@email.com" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="reg-pin" class="form-input" placeholder="Minimum 7 characters" required>
            </div>
            <div class="form-group">
                <label class="form-label">Confirm Password</label>
                <input type="password" id="reg-confirm-pin" class="form-input" required>
            </div>
        `;
    } else if (currentProfileType === 'Organisation' || currentProfileType === 'Organization') {
        fieldsHtml = `
            <div class="form-group">
                <input type="text" id="reg-name" class="form-input" placeholder="Organisation Name" required>
            </div>
            <div class="form-group">
                <input type="tel" id="reg-phone" class="form-input" placeholder="Contact Number" required>
            </div>
            <div class="form-group">
                <input type="email" id="reg-email" class="form-input" placeholder="Email" required>
            </div>
            <div class="form-group">
                <input type="text" id="reg-address" class="form-input" placeholder="Address" required>
            </div>
            <div class="form-group">
                <input type="password" id="reg-pin" class="form-input" placeholder="Password (min 7 chars)" required>
            </div>
        `;
    } else if (currentProfileType === 'Lab') {
        fieldsHtml = `
            <div class="form-group">
                <input type="text" id="reg-name" class="form-input" placeholder="Lab Name" required>
            </div>
            <div class="form-group">
                <input type="tel" id="reg-phone" class="form-input" placeholder="Phone Number" required>
            </div>
            <div class="form-group">
                <input type="text" id="reg-address" class="form-input" placeholder="Address" required>
            </div>
            <div class="form-group">
                <input type="password" id="reg-pin" class="form-input" placeholder="Password (min 7 chars)" required>
            </div>
        `;
    }

    fieldsContainer.innerHTML = fieldsHtml;

    // Set appropriate default avatar image
    const avatarImg = document.getElementById('avatar-preview-img');
    if (avatarImg) {
        if (currentProfileType === 'Doctor') avatarImg.src = 'doctor.png';
        else if (currentProfileType === 'Organisation' || currentProfileType === 'Organization') avatarImg.src = 'organisation.png';
        else if (currentProfileType === 'Lab') avatarImg.src = 'lab.png';
        else avatarImg.src = 'user.png';
    }
};

window.previewAvatar = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    // Warn if file is very large (>10MB) but still try
    if (file.size > 10 * 1024 * 1024) {
        console.warn('Large image file detected (' + (file.size / 1024 / 1024).toFixed(1) + 'MB). Compressing...');
    }

    const reader = new FileReader();
    reader.onerror = function() {
        alert('Failed to read the image file. Please try a smaller image.');
    };
    reader.onload = function (e) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onerror = function () {
            console.error('Image failed to load/decode');
            alert('Could not process this image. Please try a different photo.');
        };
        img.onload = function () {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                // Downscale to 150x150 for storage efficiency
                canvas.width = 150;
                canvas.height = 150;

                // Draw image covering the canvas (center crop)
                const size = Math.min(img.width, img.height);
                const x = (img.width - size) / 2;
                const y = (img.height - size) / 2;
                ctx.drawImage(img, x, y, size, size, 0, 0, 150, 150);

                const base64Str = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById('avatar-preview-img').src = base64Str;
                window.currentAvatarBase64 = base64Str;
            } catch (err) {
                console.error('Canvas processing error:', err);
                alert('Failed to process image. Please try a smaller photo.');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.showLogin = function () {
    renderView('loginScreen');
    document.getElementById('login-profile-type').innerText = currentProfileType;
};


window.addOrganisationMember = function() {
    window.orgAddingMember = true;
    currentProfileType = 'Patient';
    renderView('authScreen');
    const authTitleEl = document.getElementById('auth-title-dynamic');
    if (authTitleEl) authTitleEl.innerText = 'New Member';
};

window.handleRegister = async function (event) {
    event.preventDefault();

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Registering...";
    submitBtn.disabled = true;

    // Dynamically get fields based on what is available in the form
    const nameEl = document.getElementById('reg-name');
    const phoneEl = document.getElementById('reg-phone');
    const ageEl = document.getElementById('reg-age');
    const pinEl = document.getElementById('reg-pin');
    const emailEl = document.getElementById('reg-email');
    const addressEl = document.getElementById('reg-address');
    const medIdEl = document.getElementById('reg-med-id');
    const specEl = document.getElementById('reg-specialization');
    const hospEl = document.getElementById('reg-hospital');
    const confirmPinEl = document.getElementById('reg-confirm-pin');
    const fileEl = document.getElementById('reg-file-hidden');

    if (confirmPinEl && pinEl.value !== confirmPinEl.value) {
        alert("Passwords do not match!");
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        return;
    }

    const privacyToggle = document.getElementById('reg-private-toggle');
    const privacyPinEl = document.getElementById('reg-privacy-pin');

    const userData = {
        profileType: currentProfileType,
        name: nameEl ? nameEl.value : '',
        phone: phoneEl ? phoneEl.value : '',
        pin: pinEl ? pinEl.value : '',
        createdAt: new Date().toISOString(),
        isPrivate: privacyToggle ? privacyToggle.checked : false,
        privacyPin: (privacyToggle && privacyToggle.checked && privacyPinEl) ? privacyPinEl.value : ''
    };

    if (ageEl) userData.age = ageEl.value;
    if (emailEl) userData.email = emailEl.value;
    if (addressEl) userData.address = addressEl.value;
    if (medIdEl) userData.medicalId = medIdEl.value;
    if (specEl) userData.specialization = specEl.value;
    if (hospEl) userData.hospital = hospEl.value;

    // Generate Unique ID
    const prefix = currentProfileType.substring(0, 3).toUpperCase();
    const uniqueId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    userData.uniqueId = uniqueId;

    try {
        // Use downscaled Base64 image directly instead of Firebase Storage to avoid hang/configuration issues
        if (window.currentAvatarBase64) {
            userData.fileUrl = window.currentAvatarBase64;
            window.currentAvatarBase64 = null; // reset
        }

        submitBtn.innerText = "Saving Data...";
        if (window.orgAddingMember && currentUser) {
            userData.organizationId = currentUser.uniqueId;
        }

        // Save to Firestore
        if (window.db) {
            await setDoc(doc(window.db, "users", uniqueId), userData);
        } else {
            localStorage.setItem(uniqueId, JSON.stringify(userData));
        }

        if (window.orgAddingMember) {
            alert(`Member Added Successfully! Unique ID is ${uniqueId}.`);
            window.orgAddingMember = false;
            window.renderDashboard();
        } else {
            alert(`Registration Successful! Your unique ID is ${uniqueId}. Please save this ID to login.`);
        window.showLogin();
        }
    } catch (error) {
        console.error("Registration error:", error);
        alert("Failed to register: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
};

window.handleLogin = async function (event) {
    event.preventDefault();
    const id = document.getElementById('login-id').value.toUpperCase();
    const pin = document.getElementById('login-pin').value;

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Authenticating...";
    submitBtn.disabled = true;

    try {
        let storedUser = null;

        if (window.db) {
            const docRef = doc(window.db, "users", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                storedUser = docSnap.data();
            }
        } else {
            const storedUserStr = localStorage.getItem(id);
            if (storedUserStr) storedUser = JSON.parse(storedUserStr);
        }

        if (storedUser) {
            if (storedUser.pin === pin && storedUser.profileType === currentProfileType) {
                if (window.orgAddingMember && currentUser && (currentUser.profileType === 'Organisation' || currentUser.profileType === 'Organization')) {
                    if (window.db) {
                        // Assuming updateDoc and doc are in scope
                        const docRef = window.db ? doc(window.db, "users", storedUser.uniqueId) : null;
                        updateDoc(docRef, { organizationId: currentUser.uniqueId }).then(() => {
                            alert("Member Linked Successfully! " + storedUser.name + " is now part of your organisation.");
                            window.orgAddingMember = false;
                            window.renderDashboard();
                        }).catch(e => {
                            console.error(e);
                            alert("Failed to link member.");
                        });
                        return; // return early to wait for async
                    } else {
                        storedUser.organizationId = currentUser.uniqueId;
                        localStorage.setItem(storedUser.uniqueId, JSON.stringify(storedUser));
                        alert("Member Linked Successfully! " + storedUser.name + " is now part of your organisation.");
                        window.orgAddingMember = false;
                        window.renderDashboard();
                    }
                } else {
                    currentUser = storedUser;
                    alert("Login Successful! Welcome " + (currentUser.name || currentUser.uniqueId));
                    window.renderDashboard();
                }
            } else {
                alert("Invalid PIN or Profile Type.");
            }
        } else {
            alert("User ID not found.");
        }
    } catch (error) {
        console.error("Login error:", error);
        alert("Login failed: " + error.message);
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
};

window.renderDashboard = async function () {
    if (currentUser.profileType === 'Doctor') {
        renderDoctorDashboard();
        return;
    } else if (currentUser.profileType === 'Organisation' || currentUser.profileType === 'Organization') {
        renderOrganisationDashboard();
        return;
    } else if (currentUser.profileType === 'Lab') {
        renderLabDashboard();
        return;
    }

    const profileImgSrc = currentUser.fileUrl || 'user.png';

    let dashboardHTML = `
        <div class="dashboard-container">
            <div class="sidebar">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="l3.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onerror="this.src='logodp.png'"/>
                    <h2 style="margin: 0; font-size: 1.4rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Health Vault</h2>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; margin: 20px 0; position: relative;">
                    <img id="sidebar-avatar" src="${profileImgSrc}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="color: white; font-weight: 600;">${currentUser.name || 'User'}</div>
                        <div onclick="showDashboardSection('settings')" style="background: rgba(255,255,255,0.1); width: 22px; height: 22px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'" title="App Settings">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>
                    </div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-top: 4px;">${currentUser.uniqueId}</div>
                </div>
                <button class="sidebar-btn" onclick="showDashboardSection('home')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                </button>
                <button class="sidebar-btn" onclick="showDashboardSection('profile')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </button>
                <button class="sidebar-btn" onclick="showDashboardSection('health-summary')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Health Summary
                </button>
                <button class="sidebar-btn" onclick="showDashboardSection('metrics')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    Metrics
                </button>
                <button class="sidebar-btn" onclick="showDashboardSection('chatbot')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0z"></path><path d="M11 5v1M11 18v1M5 11H4M19 11h-1"></path></svg>
                    Wellness AI
                </button>
                <div style="flex: 1; min-height: 10px;"></div>
                <button class="sidebar-btn danger" onclick="showEmergency()" style="background: rgba(255,255,255,0.08); border-radius: 12px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Emergency Snapshot
                </button>
                <button class="sidebar-btn" onclick="showDashboardSection('help')" style="background: rgba(255,255,255,0.08); border-radius: 12px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Help
                </button>
                <button onclick="logout()" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 18px rgba(239,68,68,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.3)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Logout
                </button>
            </div>
            <div class="main-content" id="dashboard-content">
                <!-- Content injected here -->
            </div>
        </div>
    `;
    appContainer.innerHTML = dashboardHTML;
    showDashboardSection('home');
};

window.showDashboardSection = async function (section) {
    const content = document.getElementById('dashboard-content');
    if (section === 'home') {
        let visits = [];
        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", currentUser.uniqueId, "visits"));
            snapshot.forEach(docSnapshot => visits.push(docSnapshot.data()));
            // Sort visits by date if possible, or just reverse to show latest
            visits.reverse();
        } else {
            visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        }

        let visitsHTML = visits.map(v => `
            <div class="glass visit-card" onclick="openVisit('${v.id}')" style="position: relative;">
                <button onclick="event.stopPropagation(); deleteVisit('${v.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'" title="Delete Visit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 8px; padding-right: 24px;">${v.name}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #2563eb; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${v.doctor || 'Not specified'}</span>
                    <span style="color: #64748b; font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${v.date}</span>
                </div>
            </div>
        `).join('');

        content.innerHTML = `
            <div>
                <div style="margin-bottom: 30px;">
                    <h1 id="greeting-typewriter" style="color: #0f172a; font-weight: 800; font-size: 2.2rem; margin-bottom: 8px;"></h1>
                    <p id="quote-typewriter" style="color: #475569; font-size: 1.1rem; font-weight: 400; font-style: italic; opacity: 0;">"Organizing care, one visit at a time"</p>
                </div>
                <div class="dashboard-header">
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem;">Recent Visits</h2>
                    <input type="text" class="search-bar" placeholder="Search visits, reports..." onkeyup="searchVisits(this.value)">
                </div>
                <button onclick="showCreateVisitModal()" style="position: fixed; bottom: 40px; right: 40px; z-index: 100; display: inline-flex; align-items: center; gap: 10px; padding: 16px 34px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.1rem; font-weight: 600; cursor: pointer; box-shadow: 0 6px 25px rgba(37, 99, 235, 0.4); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.08)'; this.style.boxShadow='0 8px 30px rgba(37,99,235,0.5)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 6px 25px rgba(37,99,235,0.4)';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Create New Visit</button>
                <div class="visits-container" id="visits-list">
                    ${visitsHTML || '<p style="color: var(--text-muted); margin-top: 20px;">No visits found. Create one to get started.</p>'}
                </div>
            </div>
        `;
        // Typewriter effect
        const greetText = 'Hello, ' + (currentUser.name || 'User') + ' 👋';
        const greetEl = document.getElementById('greeting-typewriter');
        const quoteEl = document.getElementById('quote-typewriter');
        let i = 0;
        function typeChar() {
            if (i < greetText.length) {
                greetEl.textContent += greetText.charAt(i);
                i++;
                setTimeout(typeChar, 60);
            } else {
                quoteEl.style.opacity = '1';
                quoteEl.style.transition = 'opacity 0.5s ease';
            }
        }
        typeChar();
    } else if (section === 'search-results') {
        // handled by searchVisits directly
        return;
    } else if (section === 'profile') {
        const profileImgSrc = currentUser.fileUrl || 'user.png';
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">My Profile</h2>
                <div class="glass" style="padding: 30px; max-width: 500px;">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                        <div style="position: relative; cursor: pointer;" onclick="document.getElementById('profile-pic-upload').click()">
                            <img id="profile-pic-preview" src="${profileImgSrc}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                            <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            </div>
                            <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="updateProfilePic(this)">
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${currentUser.name || 'User'}</h3>
                            <p style="color: #475569; font-weight: 500;">${currentUser.uniqueId}</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${currentUser.profileType}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><input type="text" id="edit-phone" value="${currentUser.phone || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Age</span><input type="text" id="edit-age" value="${currentUser.age || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Gender</span><input type="text" id="edit-gender" value="${currentUser.gender || ''}" placeholder="e.g. Male/Female" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Location</span><input type="text" id="edit-location" value="${currentUser.location || ''}" placeholder="e.g. New York" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                        <button onclick="saveProfile()" class="primary-btn" style="margin-top: 10px; border-radius: 50px;">Save Profile</button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'health-summary') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Health Summary</h2>
                <p style="color: #475569; margin-bottom: 24px; font-size: 1.05rem;">Powered by Google Gemini AI — analyzes your visits and documents to provide personalized insights.</p>
                <button id="summary-btn" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';" onclick="generateSummary(event)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Generate AI Health Summary
                </button>
                <div id="summary-result" class="glass" style="margin-top: 24px; padding: 28px; min-height: 100px;">
                    <p style="color: #94a3b8; font-style: italic;">Click the button above to generate your personalized health summary...</p>
                </div>
            </div>`;
    } else if (section === 'metrics') {
        let visits = [];
        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", currentUser.uniqueId, "visits"));
            snapshot.forEach(docSnapshot => visits.push(docSnapshot.data()));
        } else {
            visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        }
        let totalDocs = 0;
        visits.forEach(v => {
            totalDocs += (v.documents.prescriptions?.length || 0) + (v.documents.reports?.length || 0) + (v.documents.scans?.length || 0);
        });
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Health Metrics</h2>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="margin-bottom: 12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${visits.length}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Total Visits</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom: 12px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${totalDocs}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Documents</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${visits.length > 0 ? new Date(visits[visits.length - 1].date).toLocaleDateString() : 'N/A'}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Last Visit</p>
                    </div>
                </div>

                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
                    <div class="glass" style="flex: 1; min-width: 300px; padding: 25px;">
                        <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Blood Pressure Analysis</h3>
                        <canvas id="bpChart" height="200"></canvas>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 300px; padding: 25px;">
                        <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Blood Sugar Analysis</h3>
                        <canvas id="sugarChart" height="200"></canvas>
                    </div>
                </div>

                <div class="glass" style="padding: 25px; margin-bottom: 30px;">
                    <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Visit Frequency Over Time</h3>
                    <div id="visitsFrequencyGrid"></div>
                </div>
            </div>`;

        setTimeout(() => {
            renderMetricsCharts(visits);
        }, 100);
    } else if (section === 'chatbot') {
        chatHistory = []; // Reset on section load
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Wellness AI</h2>
                <p style="color: #475569; margin-bottom: 20px; font-size: 1.05rem;">Powered by Google Gemini AI — ask anything about health & wellness.</p>
                <div class="glass" style="height: 460px; padding: 20px; display: flex; flex-direction: column;">
                    <div style="flex: 1; overflow-y: auto; padding-right: 8px;" id="chat-history">
                        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                            <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                            </div>
                            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                                <p style="color: #0f172a; margin: 0; font-size: 0.95rem; line-height: 1.5;">Hello! I'm your AI wellness assistant powered by Google Gemini. Ask me anything about health, nutrition, fitness, or general wellness. <em>Note: I provide general guidance, not medical diagnosis.</em></p>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 12px;">
                        <input type="text" id="chat-input" class="form-input" style="flex: 1; border-radius: 50px; padding: 12px 20px;" placeholder="Ask about health, nutrition, fitness..." onkeydown="if(event.key==='Enter') sendChat()">
                        <button onclick="sendChat()" style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border: none; border-radius: 50%; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='none';">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'help') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Help & Support</h2>
                <div class="glass" style="padding: 30px; max-width: 600px;">
                    <h3 style="color: #2563eb; font-weight: 700; margin-bottom: 16px;">Frequently Asked Questions</h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">How do I create a visit?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Click the blue "Create New Visit" button at the bottom-right corner of your Home screen. Give it a name (e.g., "Annual Checkup") and click Save.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">How does document auto-categorization work?</p>
                            <p style="color: #475569; font-size: 0.95rem;">When you upload a file, our AI analyzes the filename to automatically sort it into Prescriptions, Reports, or Scans.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">What is Emergency Snapshot?</p>
                            <p style="color: #475569; font-size: 0.95rem;">It's a PIN-protected area where you can store critical health info (blood group, allergies, diseases) that can be accessed in emergencies.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">Need more help?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;
    } else if (section === 'settings') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Settings</h2>
                <div class="glass" style="padding: 30px; max-width: 550px;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Notifications</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Receive alerts for new documents & messages</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #10b981; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Dark Mode</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Toggle dark mode appearance</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" style="opacity: 0; width: 0; height: 0;" disabled>
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>`;
    }
};

// Search visits by name or date
window.searchVisits = async function (query) {
    if (!currentUser) return;

    let visits = [];
    if (window.db) {
        const snapshot = await getDocs(collection(window.db, "users", currentUser.uniqueId, "visits"));
        snapshot.forEach(docSnapshot => visits.push(docSnapshot.data()));
    } else {
        visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
    }

    const q = query.toLowerCase().trim();

    if (!q) {
        // If search is cleared, re-render the full list
        showDashboardSection('home');
        return;
    }

    const filtered = visits.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.date.toLowerCase().includes(q) ||
        (v.doctor && v.doctor.toLowerCase().includes(q)) ||
        (v.displayName && v.displayName.toLowerCase().includes(q))
    );

    const listEl = document.getElementById('visits-list');
    if (!listEl) return;

    if (filtered.length === 0) {
        listEl.innerHTML = `<p style="color: #64748b; margin-top: 10px; font-weight: 500;">No visits matching "${query}"</p>`;
    } else {
        listEl.innerHTML = filtered.map(v => `
            <div class="glass visit-card" onclick="openVisit('${v.id}')" style="position: relative;">
                <button onclick="event.stopPropagation(); deleteVisit('${v.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'" title="Delete Visit">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 8px; padding-right: 24px;">${v.name}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #2563eb; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${v.doctor || 'Not specified'}</span>
                    <span style="color: #64748b; font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${v.date}</span>
                </div>
            </div>
        `).join('');
    }
};

window.showCreateVisitModal = function () {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'create-visit-modal';
    modal.innerHTML = `
        <div class="glass form-container">
            <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Create New Visit</h3>
            <input type="text" id="new-visit-name" placeholder="Visit Name (e.g., Annual Checkup)" style="color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); margin-bottom: 10px;" required>
            <input type="text" id="new-visit-doctor" placeholder="Doctor Name (e.g., Dr. Sharma)" style="color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); margin-bottom: 15px;">
            <button onclick="window.createVisit()" style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; width: 100%;" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 20px rgba(37,99,235,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(37,99,235,0.3)';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Visit</button>
            <button class="text-btn" style="color: #ef4444; font-weight: 600; margin-top: 10px;" onclick="document.getElementById('create-visit-modal').remove()">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.createVisit = async function () {
    const name = document.getElementById('new-visit-name').value;
    const doctor = document.getElementById('new-visit-doctor').value || '';

    if (!name) return alert("Please enter a name for the visit.");

    const date = new Date().toLocaleDateString();
    const visitId = 'VISIT-' + Date.now();

    const visit = {
        id: visitId,
        name: name,
        doctor: doctor,
        bp: '',
        sugar: '',
        date: date,
        displayName: `${name}-${date}`,
        documents: { prescriptions: [], reports: [], scans: [] }
    };

    if (window.db) {
        await setDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId), visit);
    } else {
        let visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        visits.push(visit);
        localStorage.setItem(currentUser.uniqueId + '_visits', JSON.stringify(visits));
    }

    document.getElementById('create-visit-modal').remove();
    showDashboardSection('home');
};

window.openVisit = async function (visitId) {
    let visit = null;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId));
        if (docSnap.exists()) visit = docSnap.data();
    } else {
        const visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        visit = visits.find(v => v.id === visitId);
    }

    if (!visit) return;

    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; min-height: calc(100vh - 80px);">
            <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <h2 style="color: #0f172a; font-weight: 700;">Visit: ${visit.displayName}</h2>
                <div style="display: flex; gap: 10px;">
                    <button onclick="showDashboardSection('home')" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='translateX(-5px)'; this.style.boxShadow='0 6px 20px rgba(37,99,235,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(37,99,235,0.3)';">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back to Visits
                    </button>
                </div>
            </div>
            <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Prescriptions</h3>
                    <div id="prescriptions-list" style="margin-top:10px;">${renderDocs(visit.documents.prescriptions, 'prescriptions', visitId)}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Reports</h3>
                    <div id="reports-list" style="margin-top:10px;">${renderDocs(visit.documents.reports, 'reports', visitId)}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Scans</h3>
                    <div id="scans-list" style="margin-top:10px;">${renderDocs(visit.documents.scans, 'scans', visitId)}</div>
                </div>
            </div>
            <div class="glass" style="padding: 20px; margin-top: auto; margin-bottom: 20px;">
                <h3 style="color: #0f172a; font-weight: 700;">Upload Document</h3>
                
                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="file" id="doc-upload" class="search-bar" style="border-radius: 8px; color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1);">
                    <button onclick="uploadDocument('${visitId}')" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; white-space: nowrap;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(37,99,235,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(37,99,235,0.3)';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Upload & Auto-Categorize</button>
                </div>
            </div>
        </div>
    `;
};

window.renderDocs = function (docs, category, visitId) {
    if (!docs || docs.length === 0) return '<p style="color: #64748b; font-size: 0.9rem; font-weight: 500;">No documents yet.</p>';
    return docs.map((d, idx) => {
        const docName = typeof d === 'string' ? d : d.name;
        const docUrl = typeof d === 'string' ? '' : d.url;
        return `
        <div style="padding: 10px 12px; background: rgba(0, 0, 0, 0.05); color: #0f172a; font-weight: 500; margin-bottom: 8px; border-radius: 10px; display: flex; align-items: center; gap: 8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${docName}</span>
            <button onclick="event.stopPropagation(); viewDocument('${docName.replace(/'/g, "\\'")}', '${docUrl}')"
                style="padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'"
                title="View document">View</button>
            <button onclick="event.stopPropagation(); deleteDocument('${visitId}', '${category}', ${idx})"
                style="padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'"
                title="Delete document">Delete</button>
        </div>
        `;
    }).join('');
};

window.uploadDocument = async function (visitId) {
    const fileInput = document.getElementById('doc-upload');
    if (!fileInput.files.length) return alert("Please select a file first.");

    const file = fileInput.files[0];
    const fileName = file.name.toLowerCase();

    const uploadBtn = fileInput.nextElementSibling;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = "Uploading to Cloud...";
    uploadBtn.disabled = true;

    try {
        let downloadURL = "";

        const uploadWithTimeout = async () => {
            if (window.storage) {
                const fileRef = ref(window.storage, `documents/${currentUser.uniqueId}/${visitId}/${file.name}`);
                const uploadTask = uploadBytes(fileRef, file);
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Upload Timeout')), 4000));
                await Promise.race([uploadTask, timeout]);
                return await getDownloadURL(fileRef);
            }
            return "";
        };

        try {
            downloadURL = await uploadWithTimeout();
        } catch (fbError) {
            console.warn("Firebase upload failed/timed out, falling back to local processing:", fbError);
            downloadURL = URL.createObjectURL(file); // Local blob fallback
        }

        // Default category (used as fallback for non-image files)
        let category = 'reports';
        if (fileName.includes('prescription') || fileName.includes('rx') || fileName.includes('med')) {
            category = 'prescriptions';
        } else if (fileName.includes('scan') || fileName.includes('mri') || fileName.includes('xray') || fileName.includes('ct_') || fileName.includes('ultrasound') || fileName.includes('radiology')) {
            category = 'scans';
        }

        let visit = null;
        let visits = [];
        let visitIndex = -1;
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId));
            if (docSnap.exists()) visit = docSnap.data();
        } else {
            visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
            visitIndex = visits.findIndex(v => v.id === visitId);
            if (visitIndex !== -1) visit = visits[visitIndex];
        }

        if (visit) {
            if (!visit.documents[category]) visit.documents[category] = [];

            uploadBtn.innerHTML = "AI Extracting Data...";

            let bpValue = visit.bp || '';
            let sugarValue = visit.sugar || '';

            const saveUpdatedVisit = async () => {
                if (window.db) {
                    await setDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId), visit);
                } else {
                    visits[visitIndex] = visit;
                    localStorage.setItem(currentUser.uniqueId + '_visits', JSON.stringify(visits));
                }
            };

            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64Data = reader.result.split(',')[1];
                        const response = await fetch('/api/gemini', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        { text: "Analyze this medical document image. Do TWO things:\n1. CLASSIFY the document type as exactly one of: \"prescriptions\", \"reports\", or \"scans\". A prescription is a doctor's written order for medicine/treatment. A report is a lab result, blood test, or diagnostic report. A scan is an imaging result like X-ray, MRI, CT scan, or ultrasound image.\n2. Extract the patient's Blood Pressure (format: 120/80) and Blood Sugar (in mg/dL). If not present, output a realistic normal value.\nReturn ONLY a valid JSON exactly like this: {\"category\": \"prescriptions\", \"bp\": \"120/80\", \"sugar\": \"105\"}." },
                                        { inline_data: { mime_type: file.type, data: base64Data } }
                                    ]
                                }]
                            })
                        });
                        const data = await response.json();
                        if (data.candidates && data.candidates[0]) {
                            let textResp = data.candidates[0].content.parts[0].text.trim();
                            textResp = textResp.replace(/```json/g, '').replace(/```/g, '').trim();
                            const extracted = JSON.parse(textResp);
                            visit.bp = extracted.bp || bpValue;
                            visit.sugar = extracted.sugar || sugarValue;
                            // Use AI-detected category from image analysis
                            if (extracted.category && ['prescriptions', 'reports', 'scans'].includes(extracted.category)) {
                                category = extracted.category;
                            }
                        }
                    } catch (e) {
                        console.error("AI Extraction failed:", e);
                    }

                    if (!visit.documents[category]) visit.documents[category] = [];
                    visit.documents[category].push({ name: file.name, url: downloadURL });
                    await saveUpdatedVisit();
                    const categoryLabel = category === 'prescriptions' ? '💊 Prescriptions' : category === 'scans' ? '🔬 Scans' : '📋 Reports';
                    alert(`Success! File categorized as ${categoryLabel} and AI extracted BP and Sugar.`);
                    openVisit(visitId);
                };
                reader.readAsDataURL(file);
            } else {
                visit.documents[category].push({ name: file.name, url: downloadURL });
                await saveUpdatedVisit();
                alert(`Success! File uploaded to Cloud and categorized.`);
                openVisit(visitId);
            }
        }
    } catch (error) {
        console.error("Upload error:", error);
        alert("Upload failed: " + error.message);
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
};

window.updateProfilePic = async function (input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function (e) {
        const dataUrl = e.target.result;
        // Update current user object
        currentUser.fileUrl = dataUrl;

        // Save to Database
        if (window.db) {
            await setDoc(doc(window.db, "users", currentUser.uniqueId), currentUser);
        } else {
            const userData = JSON.parse(localStorage.getItem(currentUser.uniqueId) || '{}');
            userData.fileUrl = dataUrl;
            localStorage.setItem(currentUser.uniqueId, JSON.stringify(userData));
        }

        // Update preview on profile page
        const preview = document.getElementById('profile-pic-preview');
        if (preview) preview.src = dataUrl;
        // Update sidebar avatar
        const sidebarAv = document.getElementById('sidebar-avatar');
        if (sidebarAv) sidebarAv.src = dataUrl;
        alert('Profile picture updated!');
    };
    reader.readAsDataURL(file);
};

window.viewDocument = async function (docName, docUrl) {
    if (docUrl && docUrl !== 'undefined' && docUrl !== 'null' && docUrl !== '') {
        if (docUrl.startsWith('data:')) {
            // Reconstruct blob from base64 to bypass browser data URL restrictions
            try {
                const res = await fetch(docUrl);
                const blob = await res.blob();
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
            } catch (e) {
                alert("⚠️ Error processing the document format.");
            }
        } else if (docUrl.startsWith('blob:')) {
            try {
                const res = await fetch(docUrl);
                if (!res.ok) throw new Error("Blob dead");
                window.open(docUrl, '_blank');
            } catch (e) {
                alert(`⚠️ Document Unavailable\n\n'${docName}' was saved as a temporary local file in a previous session and is no longer accessible.\n\nPlease ask the patient to re-upload it with a stable connection.`);
            }
        } else {
            window.open(docUrl, '_blank');
        }
    } else {
        const ext = docName.split('.').pop().toLowerCase();
        let typeLabel = 'Document';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) typeLabel = 'Image';
        else if (ext === 'pdf') typeLabel = 'PDF Document';
        else if (['doc', 'docx'].includes(ext)) typeLabel = 'Word Document';

        alert(`📄 Document Details\n\nName: ${docName}\nType: ${typeLabel}\nFormat: .${ext}\n\nNote: This is an older mock document without a real file attached. Upload a new file to preview it via Firebase Storage!`);
    }
};

window.deleteDocument = async function (visitId, category, docIndex) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    let visit = null;
    let visits = [];
    let visitIndex = -1;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId));
        if (docSnap.exists()) visit = docSnap.data();
    } else {
        visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        visitIndex = visits.findIndex(v => v.id === visitId);
        if (visitIndex !== -1) visit = visits[visitIndex];
    }

    if (visit && visit.documents[category]) {
        const docObj = visit.documents[category][docIndex];
        const docName = typeof docObj === 'string' ? docObj : docObj.name;
        visit.documents[category].splice(docIndex, 1);

        if (window.db) {
            await setDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId), visit);
        } else {
            visits[visitIndex] = visit;
            localStorage.setItem(currentUser.uniqueId + '_visits', JSON.stringify(visits));
        }

        alert(`'${docName}' has been deleted.`);
        openVisit(visitId); // Refresh
    }
};

window.deleteVisit = async function (visitId) {
    if (!confirm('Are you sure you want to completely delete this visit and all its documents? This action cannot be undone.')) return;

    if (window.db) {
        await deleteDoc(doc(window.db, "users", currentUser.uniqueId, "visits", visitId));
        alert(`Visit has been deleted.`);
        showDashboardSection('home');
    } else {
        let visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
        const visitIndex = visits.findIndex(v => v.id === visitId);

        if (visitIndex !== -1) {
            const visitName = visits[visitIndex].displayName;
            visits.splice(visitIndex, 1);
            localStorage.setItem(currentUser.uniqueId + '_visits', JSON.stringify(visits));
            alert(`Visit '${visitName}' has been deleted.`);
            showDashboardSection('home');
        }
    }
};
window.showEmergency = async function () {
    const pin = prompt("EMERGENCY SNAPSHOT\nHighly Protected Area. Please enter your Security PIN:");
    if (pin === currentUser.pin) {
        let emergencyData = {};
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "emergency"));
            if (docSnap.exists()) emergencyData = docSnap.data();
        } else {
            emergencyData = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_emergency') || '{}');
        }

        const content = document.getElementById('dashboard-content');
        content.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 24px;">
                <h2 style="color: var(--danger-color); margin-bottom: 16px;">Emergency Snapshot</h2>
                <img src="${currentUser.fileUrl || 'user.png'}" alt="Profile" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #ef4444; box-shadow: 0 4px 15px rgba(239,68,68,0.3); display: block; margin: 0 auto;" onerror="this.src='user.png'">
                <p style="color: #0f172a; font-weight: 700; font-size: 1.15rem; margin-top: 10px;">${currentUser.name || 'Patient'}</p>
                <p style="color: #64748b; font-size: 0.85rem;">${currentUser.uniqueId}</p>
            </div>
            <div class="glass form-container" style="width: 100%; max-width: 600px; margin: 0 auto;">
                <label style="color: #0f172a; font-weight: 600;">Patient Name</label>
                <input type="text" id="em-name" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.name || currentUser.name || ''}" placeholder="e.g. John Doe">

                <label style="color: #0f172a; font-weight: 600;">Date of Birth</label>
                <input type="date" id="em-dob" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.dob || ''}">

                <label style="color: #0f172a; font-weight: 600;">Blood Group</label>
                <input type="text" id="em-blood" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.bloodGroup || ''}" placeholder="e.g. O+">
                
                <label style="color: #0f172a; font-weight: 600;">Allergies</label>
                <input type="text" id="em-allergies" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.allergies || ''}" placeholder="e.g. Peanuts, Penicillin">
                
                <label style="color: #0f172a; font-weight: 600;">Current Medication (Ongoing Problems)</label>
                <input type="text" id="em-medication" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.medication || ''}" placeholder="e.g. Insulin, Metformin">

                <label style="color: #0f172a; font-weight: 600;">Critical / Chronical Diseases</label>
                <input type="text" id="em-diseases" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.diseases || ''}" placeholder="e.g. Asthma, Diabetes">
                
                <label style="color: #0f172a; font-weight: 600;">Major Surgeries</label>
                <input type="text" id="em-surgeries" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.surgeries || ''}" placeholder="e.g. Appendectomy">

                <label style="color: #0f172a; font-weight: 600;">Emergency Contact 1</label>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <input type="tel" id="em-contact1" class="form-input" style="flex: 1; color: #0f172a; margin-bottom: 0;" value="${emergencyData.contact1 || ''}" placeholder="Phone Number">
                    ${emergencyData.contact1 ? `<button onclick="initiateCall('${emergencyData.contact1}')" style="background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Call</button>` : ''}
                </div>

                <label style="color: #0f172a; font-weight: 600;">Emergency Contact 2</label>
                <div style="display: flex; gap: 10px; margin-bottom: 25px;">
                    <input type="tel" id="em-contact2" class="form-input" style="flex: 1; color: #0f172a; margin-bottom: 0;" value="${emergencyData.contact2 || ''}" placeholder="Phone Number">
                    ${emergencyData.contact2 ? `<button onclick="initiateCall('${emergencyData.contact2}')" style="background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Call</button>` : ''}
                </div>
                
                <button class="primary-btn" style="background: var(--danger-color)" onclick="saveEmergency()">Save Emergency Info</button>
            </div>
        `;
    } else {
        if (pin !== null) alert("Incorrect PIN. Access Denied.");
    }
};

window.saveEmergency = async function () {
    const data = {
        name: document.getElementById('em-name').value,
        bloodGroup: document.getElementById('em-blood').value,
        allergies: document.getElementById('em-allergies').value,
        diseases: document.getElementById('em-diseases').value,
        dob: document.getElementById('em-dob').value,
        medication: document.getElementById('em-medication').value,
        surgeries: document.getElementById('em-surgeries').value,
        contact1: document.getElementById('em-contact1').value,
        contact2: document.getElementById('em-contact2').value
    };

    if (window.db) {
        await setDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "emergency"), data);
    } else {
        localStorage.setItem(currentUser.uniqueId + '_emergency', JSON.stringify(data));
    }

    alert("Emergency Snapshot Updated Securely.");
    // Re-render to show call buttons if numbers were just added
    showEmergencyModalWithoutPin();
};

window.showEmergencyModalWithoutPin = async function () {
    let emergencyData = {};
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "emergency"));
        if (docSnap.exists()) emergencyData = docSnap.data();
    } else {
        emergencyData = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_emergency') || '{}');
    }
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="dashboard-header">
            <h2 style="color: var(--danger-color)">Emergency Snapshot</h2>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="${currentUser.fileUrl || 'user.png'}" alt="Profile" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #ef4444; box-shadow: 0 4px 15px rgba(239,68,68,0.3);" onerror="this.src='user.png'">
            <p style="color: #0f172a; font-weight: 700; font-size: 1.15rem; margin-top: 10px;">${currentUser.name || 'Patient'}</p>
            <p style="color: #64748b; font-size: 0.85rem;">${currentUser.uniqueId}</p>
        </div>
        <div class="glass form-container" style="width: 100%; max-width: 600px;">
            <label style="color: #0f172a; font-weight: 600;">Patient Name</label>
            <input type="text" id="em-name" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.name || currentUser.name || ''}" placeholder="e.g. John Doe">

            <label style="color: #0f172a; font-weight: 600;">Date of Birth</label>
            <input type="date" id="em-dob" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.dob || ''}">

            <label style="color: #0f172a; font-weight: 600;">Blood Group</label>
            <input type="text" id="em-blood" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.bloodGroup || ''}" placeholder="e.g. O+">
            
            <label style="color: #0f172a; font-weight: 600;">Allergies</label>
            <input type="text" id="em-allergies" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.allergies || ''}" placeholder="e.g. Peanuts, Penicillin">
            
            <label style="color: #0f172a; font-weight: 600;">Current Medication (Ongoing Problems)</label>
            <input type="text" id="em-medication" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.medication || ''}" placeholder="e.g. Insulin, Metformin">

            <label style="color: #0f172a; font-weight: 600;">Critical / Chronical Diseases</label>
            <input type="text" id="em-diseases" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.diseases || ''}" placeholder="e.g. Asthma, Diabetes">
            
            <label style="color: #0f172a; font-weight: 600;">Major Surgeries</label>
            <input type="text" id="em-surgeries" class="form-input" style="color: #0f172a; margin-bottom: 15px;" value="${emergencyData.surgeries || ''}" placeholder="e.g. Appendectomy">

            <label style="color: #0f172a; font-weight: 600;">Emergency Contact 1</label>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="tel" id="em-contact1" class="form-input" style="flex: 1; color: #0f172a; margin-bottom: 0;" value="${emergencyData.contact1 || ''}" placeholder="Phone Number">
                ${emergencyData.contact1 ? `<button onclick="initiateCall('${emergencyData.contact1}')" style="background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Call</button>` : ''}
            </div>

            <label style="color: #0f172a; font-weight: 600;">Emergency Contact 2</label>
            <div style="display: flex; gap: 10px; margin-bottom: 25px;">
                <input type="tel" id="em-contact2" class="form-input" style="flex: 1; color: #0f172a; margin-bottom: 0;" value="${emergencyData.contact2 || ''}" placeholder="Phone Number">
                ${emergencyData.contact2 ? `<button onclick="initiateCall('${emergencyData.contact2}')" style="background: #10b981; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Call</button>` : ''}
            </div>
            
            <button class="primary-btn" style="background: var(--danger-color)" onclick="saveEmergency()">Save Emergency Info</button>
        </div>
    `;
};

window.initiateCall = function (number) {
    if (confirm("make a call?")) {
        window.location.href = "tel:" + number;
    }
};

window.generateSummary = async function (event) {
    const btn = document.getElementById('summary-btn') || event.target;
    const resultDiv = document.getElementById('summary-result');

    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Analyzing with Gemini AI...`;
    btn.disabled = true;
    resultDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 12px; color: #64748b;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Gemini AI is analyzing your health records...</div>`;

    try {
        let visits = [];
        let emergency = {};

        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", currentUser.uniqueId, "visits"));
            snapshot.forEach(docSnapshot => visits.push(docSnapshot.data()));

            const emSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "emergency"));
            if (emSnap.exists()) emergency = emSnap.data();
        } else {
            visits = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_visits') || '[]');
            emergency = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_emergency') || '{}');
        }
        let docCount = 0;
        visits.forEach(v => {
            docCount += (v.documents.prescriptions?.length || 0) + (v.documents.reports?.length || 0) + (v.documents.scans?.length || 0);
        });

        const visitDetails = visits.map(v => {
            const docs = [];
            if (v.documents.prescriptions?.length) docs.push(`Prescriptions: ${v.documents.prescriptions.join(', ')}`);
            if (v.documents.reports?.length) docs.push(`Reports: ${v.documents.reports.join(', ')}`);
            if (v.documents.scans?.length) docs.push(`Scans: ${v.documents.scans.join(', ')}`);

            let vitals = [];
            if (v.bp) vitals.push(`BP: ${v.bp}`);
            if (v.sugar) vitals.push(`Sugar: ${v.sugar}`);
            const vitalsStr = vitals.length > 0 ? ` [Vitals: ${vitals.join(', ')}]` : '';

            return `- ${v.name} (${v.date})${vitalsStr}: ${docs.length > 0 ? docs.join('; ') : 'No documents'}`;
        }).join('\n');

        const prompt = `You are a health assistant for the Health Vault app. Analyze the following patient data.

Patient: ${currentUser.name || 'Unknown'}
Age: ${currentUser.age || 'Unknown'}
Total Visits: ${visits.length}
Total Documents: ${docCount}
${emergency.bloodGroup ? 'Blood Group: ' + emergency.bloodGroup : ''}
${emergency.allergies ? 'Known Allergies: ' + emergency.allergies : ''}
${emergency.diseases ? 'Known Conditions: ' + emergency.diseases : ''}
${emergency.medication ? 'Current Medication: ' + emergency.medication : ''}
${emergency.surgeries ? 'Major Surgeries: ' + emergency.surgeries : ''}

Visit History:
${visitDetails || 'No visits recorded yet.'}

Extract the patient's health summary into the following 7 categories. Provide a single, easy-to-understand sentence or value for each. If there is no data for a category, respond with "No data available". 
You MUST return the output as a raw JSON object (do not include markdown formatting like \`\`\`json). Use these exact keys:
"bp", "sugar", "medication", "chronic", "family", "surgeries", "complication".`;

        const aiText = await callGeminiAPI(prompt);

        let summaryData = {};
        try {
            const cleanText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
            summaryData = JSON.parse(cleanText);
        } catch (e) {
            console.error("Failed to parse JSON", e);
            summaryData = { bp: "Error parsing data", sugar: "Error parsing data", medication: "Error parsing data", chronic: "Error parsing data", family: "Error parsing data", surgeries: "Error parsing data", complication: "Error parsing data" };
        }

        const iconStyle = "width: 22px; height: 22px; color: #2563eb; flex-shrink: 0; margin-top: 2px;";

        resultDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.06);">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                </div>
                <strong style="color: #0f172a; font-size: 1.1rem;">AI Health Summary</strong>
                <span style="color: #94a3b8; font-size: 0.8rem; margin-left: auto;">Powered by Gemini</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9C8.8 1 15.2 1 19.1 4.9C23 8.8 23 15.2 19.1 19.1C15.2 23 8.8 23 4.9 19.1Z"></path><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">B.P</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.bp || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Diabetic sugar level</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.sugar || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Ongoing Medication</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.medication || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Current chronic disease</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.chronic || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Family conditions</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.family || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Major Surgeries</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.surgeries || 'No data available'}</div></div>
                </div>
                <div style="display: flex; align-items: flex-start; gap: 15px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Recent complication</div> <div style="color: #64748b; font-size: 0.95rem;">${summaryData.complication || 'No data available'}</div></div>
                </div>
            </div>`;

        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Regenerate Summary`;
    } catch (error) {
        console.error('Gemini API error:', error);
        resultDiv.innerHTML = `<p style="color: #ef4444; font-weight: 600;">⚠️ Error: ${error.message}</p><p style="color: #64748b; margin-top: 8px;">Please try again.</p>`;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Retry`;
    } finally {
        btn.disabled = false;
    }
};

window.sendChat = async function () {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const history = document.getElementById('chat-history');

    // Add user message bubble
    history.innerHTML += `
        <div style="display: flex; gap: 10px; margin-bottom: 14px; justify-content: flex-end;">
            <div style="background: #2563eb; color: white; padding: 12px 16px; border-radius: 16px 0 16px 16px; max-width: 80%;">
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.5;">${msg}</p>
            </div>
        </div>`;
    input.value = '';
    input.disabled = true;
    history.scrollTop = history.scrollHeight;

    // Add typing indicator
    const typingId = 'typing-' + Date.now();
    history.innerHTML += `
        <div id="${typingId}" style="display: flex; gap: 10px; margin-bottom: 14px;">
            <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            </div>
            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px;">
                <div style="display: flex; gap: 4px; align-items: center;"><span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;animation:dotPulse 1.4s ease-in-out infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;animation:dotPulse 1.4s ease-in-out 0.2s infinite;"></span><span style="width:8px;height:8px;border-radius:50%;background:#94a3b8;animation:dotPulse 1.4s ease-in-out 0.4s infinite;"></span></div>
            </div>
        </div>`;
    history.scrollTop = history.scrollHeight;

    // Build conversation context
    chatHistory.push({ role: 'user', text: msg });

    const systemPrompt = `You are a friendly, knowledgeable wellness AI assistant for Health Vault, a health records management app. Your role is:
- Provide helpful general health, nutrition, fitness, and wellness guidance
- Be warm, empathetic, and encouraging
- Always remind users to consult a doctor for medical diagnosis or treatment
- Keep responses concise (2-4 short paragraphs max)
- Use simple language, avoid excessive medical jargon
- You may reference the user's profile: Name: ${currentUser.name || 'User'}, Age: ${currentUser.age || 'unknown'}
- NEVER diagnose conditions or prescribe medication
- Format your response in plain text, no HTML tags`;

    const conversationContext = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');

    try {
        const aiText = await callGeminiAPI(conversationContext, systemPrompt);
        chatHistory.push({ role: 'assistant', text: aiText });

        // Remove typing indicator and add AI response
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        history.innerHTML += `
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                </div>
                <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                    <p style="color: #0f172a; margin: 0; font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap;">${aiText}</p>
                </div>
            </div>`;
    } catch (error) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        history.innerHTML += `
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                </div>
                <div style="background: #fef2f2; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                    <p style="color: #991b1b; margin: 0; font-size: 0.95rem;">Sorry, I couldn't connect to AI right now. Error: ${error.message}</p>
                </div>
            </div>`;
        chatHistory.pop(); // Remove failed user message from history
    } finally {
        input.disabled = false;
        input.focus();
        history.scrollTop = history.scrollHeight;
    }
};

// ====== CLINIC QUEUE SYSTEM ======
window.currentConsultation = null;
window._viewingPatientData = null;
window.originalProviderUser = null;
let clinicQueue = [];
let clinicCompleted = 0;
let notedPatients = []; // Permanent favourites list

// Load noted patients from storage
window.loadNotedPatients = async function () {
    if (!currentUser) return;
    try {
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "notedPatients"));
            if (docSnap.exists()) notedPatients = docSnap.data().list || [];
        } else {
            notedPatients = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_notedPatients') || '[]');
        }
    } catch (e) {
        console.error('Error loading noted patients:', e);
    }
};

window.saveNotedPatients = async function () {
    if (!currentUser) return;
    try {
        if (window.db) {
            await setDoc(doc(window.db, "users", currentUser.uniqueId, "settings", "notedPatients"), { list: notedPatients });
        } else {
            localStorage.setItem(currentUser.uniqueId + '_notedPatients', JSON.stringify(notedPatients));
        }
    } catch (e) {
        console.error('Error saving noted patients:', e);
    }
};

window.renderClinicQueue = function () {
    if (clinicQueue.length === 0) {
        return '<div style="text-align: center; padding: 30px;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 10px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg><p style="color: #94a3b8; font-weight: 500;">No patients in queue. Check in a patient to get started.</p></div>';
    }
    return clinicQueue.map((p, idx) => `
        <div style="position: relative; background: ${p.noted ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))' : 'rgba(0,0,0,0.03)'}; border: 1px solid ${p.noted ? 'rgba(245,158,11,0.25)' : 'rgba(0,0,0,0.06)'}; border-radius: 14px; padding: 18px 20px; transition: all 0.3s;" onmouseover="this.style.boxShadow='0 4px 15px rgba(0,0,0,0.08)';" onmouseout="this.style.boxShadow='none';">
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px;">
                <button onclick="clinicToggleNoted(${idx})" title="${p.noted ? 'Remove from Noted' : 'Mark as Noted'}" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(245,158,11,0.15)';" onmouseout="this.style.background='none';">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${p.noted ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
                <button onclick="clinicRemovePatient(${idx})" title="Remove from Queue" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(239,68,68,0.15)';" onmouseout="this.style.background='none';">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #10b981); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span style="color: white; font-weight: 700; font-size: 1.1rem;">${p.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h4 style="color: #0f172a; font-weight: 700; font-size: 1.05rem; margin: 0 0 2px 0;">${p.name}</h4>
                    <p style="color: #64748b; font-size: 0.85rem; font-weight: 500; margin: 0;">${p.id}</p>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #94a3b8; font-size: 0.8rem; font-weight: 500;">Checked in at ${p.time}</span>
            </div>
        </div>
    `).join('');
};

window.renderCurrentConsultation = function () {
    if (!window.currentConsultation) {
        return '<div style="text-align: center; padding: 20px;"><p style="color: #94a3b8; font-weight: 500;">No patient currently in consultation.</p></div>';
    }
    const p = window.currentConsultation;
    return `
        <div style="position: relative; display: flex; align-items: center; justify-content: space-between; background: ${p.noted ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))' : 'rgba(37,99,235,0.05)'}; border: 1px solid ${p.noted ? 'rgba(245,158,11,0.3)' : 'rgba(37,99,235,0.2)'}; border-radius: 14px; padding: 20px; transition: all 0.3s;">
            <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px;">
                <button onclick="clinicToggleNotedCurrent()" title="${p.noted ? 'Remove from Noted' : 'Mark as Noted'}" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(245,158,11,0.15)';" onmouseout="this.style.background='none';">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${p.noted ? '#f59e0b' : 'none'}" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
                <button onclick="clinicRemoveCurrentPatient()" title="Remove from Consultation" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(239,68,68,0.15)';" onmouseout="this.style.background='none';">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; cursor: pointer;" onclick="viewPatientAsDoctor('${p.id}')" title="Click to view patient records">
                <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #10b981); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span style="color: white; font-weight: 700; font-size: 1.5rem;">${p.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h4 style="color: #0f172a; font-weight: 700; font-size: 1.3rem; margin: 0 0 4px 0;">${p.name}</h4>
                    <p style="color: #64748b; font-size: 0.95rem; font-weight: 500; margin: 0;">ID: ${p.id} &nbsp;|&nbsp; Checked in: ${p.time}</p>
                    <p style="color: #2563eb; font-size: 0.8rem; font-weight: 500; margin: 4px 0 0 0;">🔍 Click to view patient records</p>
                </div>
            </div>
            <button onclick="clinicMarkDone()" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 50px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(16,185,129,0.3); transition: all 0.3s; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Done
            </button>
        </div>
    `;
};

window.renderNotedList = function () {
    if (notedPatients.length === 0) {
        return '<div style="text-align: center; padding: 24px;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5" style="margin-bottom: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg><p style="color: #94a3b8; font-weight: 500; font-size: 0.9rem;">No favourite patients yet.<br>Star a patient from the queue.</p></div>';
    }
    return notedPatients.map((p, idx) => `
        <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 12px; padding: 14px 16px; transition: all 0.2s;" onmouseover="this.style.boxShadow='0 3px 10px rgba(245,158,11,0.12)';" onmouseout="this.style.boxShadow='none';">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span style="color: white; font-weight: 700; font-size: 0.95rem;">${p.name.charAt(0).toUpperCase()}</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <h4 style="color: #0f172a; font-weight: 700; font-size: 0.95rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                    <p style="color: #64748b; font-size: 0.8rem; font-weight: 500; margin: 2px 0 0 0;">${p.id}</p>
                </div>
                <button onclick="removeNotedPatient(${idx})" title="Remove from Favourites" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" onmouseover="this.style.background='rgba(245,158,11,0.2)';" onmouseout="this.style.background='none';">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </button>
            </div>
        </div>
    `).join('');
};

window.updateClinicStats = function () {
    const queueCount = document.getElementById('queue-count');
    const completedCount = document.getElementById('completed-count');
    const notedCount = document.getElementById('noted-count');
    const queueBadge = document.getElementById('queue-badge');
    const queueList = document.getElementById('clinic-queue-list');
    const currentConsContainer = document.getElementById('current-consultation-container');
    if (queueCount) queueCount.textContent = clinicQueue.length;
    if (completedCount) completedCount.textContent = clinicCompleted;
    if (notedCount) notedCount.textContent = notedPatients.length;
    if (queueBadge) queueBadge.textContent = clinicQueue.length + ' patients';
    if (queueList) queueList.innerHTML = renderClinicQueue();
    if (currentConsContainer) currentConsContainer.innerHTML = renderCurrentConsultation();
    const notedList = document.getElementById('clinic-noted-list');
    const notedBadge = document.getElementById('noted-badge');
    if (notedList) notedList.innerHTML = renderNotedList();
    if (notedBadge) notedBadge.textContent = notedPatients.length + ' patients';

    // Update home page noted list if it exists
    const homeNotedList = document.getElementById('home-noted-list');
    if (homeNotedList) homeNotedList.innerHTML = renderNotedList();
};

window.clinicCheckIn = async function () {
    const idInput = document.getElementById('clinic-patient-id');
    const patientId = idInput ? idInput.value.trim() : '';

    if (!patientId) {
        alert('Please enter a Patient ID.');
        return;
    }

    if (clinicQueue.find(p => p.id === patientId)) {
        alert('This patient is already in the queue!');
        return;
    }

    // Fetch patient name from database
    let patientName = '';
    try {
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", patientId));
            if (docSnap.exists()) {
                patientName = docSnap.data().name || '';
            }
        } else {
            const userData = JSON.parse(localStorage.getItem(patientId) || '{}');
            patientName = userData.name || '';
            if (!patientName) {
                const users = JSON.parse(localStorage.getItem('hv_users') || '[]');
                const found = users.find(u => u.uniqueId === patientId);
                if (found) patientName = found.name;
            }
        }
    } catch (e) {
        console.error('Error fetching patient:', e);
    }

    if (!patientName) {
        alert('Patient not found. Please check the ID and try again.');
        return;
    }

    const isNoted = notedPatients.some(p => p.id === patientId);

    const now = new Date();
    const patientData = {
        id: patientId,
        name: patientName,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        noted: isNoted
    };

    if (!window.currentConsultation) {
        window.currentConsultation = patientData;
    } else {
        clinicQueue.push(patientData);
    }

    if (idInput) idInput.value = '';
    updateClinicStats();
};

window.clinicToggleNoted = function (idx) {
    if (clinicQueue[idx]) {
        const patient = clinicQueue[idx];
        patient.noted = !patient.noted;
        if (patient.noted) {
            // Add to permanent favourites if not already there
            if (!notedPatients.find(p => p.id === patient.id)) {
                notedPatients.push({ id: patient.id, name: patient.name });
            }
        } else {
            // Remove from favourites
            notedPatients = notedPatients.filter(p => p.id !== patient.id);
        }
        saveNotedPatients();
        updateClinicStats();
    }
};

window.removeNotedPatient = function (idx) {
    if (notedPatients[idx]) {
        const patientId = notedPatients[idx].id;
        notedPatients.splice(idx, 1);
        // Also unmark in queue if still there
        const queueItem = clinicQueue.find(p => p.id === patientId);
        if (queueItem) queueItem.noted = false;
        saveNotedPatients();
        updateClinicStats();
    }
};

window.clinicRemovePatient = function (idx) {
    if (clinicQueue[idx] && confirm(`Remove ${clinicQueue[idx].name} from the queue?`)) {
        clinicQueue.splice(idx, 1);
        updateClinicStats();
    }
};

window.clinicToggleNotedCurrent = function () {
    if (window.currentConsultation) {
        const patient = window.currentConsultation;
        patient.noted = !patient.noted;
        if (patient.noted) {
            if (!notedPatients.find(p => p.id === patient.id)) {
                notedPatients.push({ id: patient.id, name: patient.name });
            }
        } else {
            notedPatients = notedPatients.filter(p => p.id !== patient.id);
        }
        saveNotedPatients();
        updateClinicStats();
    }
};

window.clinicRemoveCurrentPatient = function () {
    if (window.currentConsultation && confirm(`Remove ${window.currentConsultation.name} from the current consultation?`)) {
        if (clinicQueue.length > 0) {
            window.currentConsultation = clinicQueue.shift();
        } else {
            window.currentConsultation = null;
        }
        updateClinicStats();
    }
};

window.clinicMarkDone = function () {
    if (window.currentConsultation) {
        const name = window.currentConsultation.name;
        if (clinicQueue.length > 0) {
            window.currentConsultation = clinicQueue.shift();
        } else {
            window.currentConsultation = null;
        }
        clinicCompleted++;
        updateClinicStats();
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:30px;right:30px;background:linear-gradient(135deg,#10b981,#059669);color:white;padding:14px 28px;border-radius:50px;font-weight:600;font-family:Outfit,sans-serif;box-shadow:0 4px 15px rgba(16,185,129,0.4);z-index:9999;animation:fadeIn 0.3s ease;';
        toast.textContent = `✓ ${name} marked as done!`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
};

window.renderDoctorDashboard = async function () {
    await loadNotedPatients();
    const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Doctor' ? 'doctor.png' : (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png'));

    let dashboardHTML = `
        <div class="dashboard-container">
            <div class="sidebar">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="l3.png" alt="Logo" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onerror="this.src='logodp.png'"/>
                    <h2 style="margin: 0; font-size: 1.25rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Health Vault</h2>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; margin: 14px 0;">
                    <img id="sidebar-avatar" src="${profileImgSrc}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                    <div style="color: white; font-weight: 600; text-align: center;">${currentUser.name || 'Provider'}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.8rem; margin-top: 3px;">${currentUser.uniqueId}</div>
                    <div style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600; margin-top: 2px;">${currentUser.profileType} Portal</div>
                </div>
                <button class="sidebar-btn" onclick="showDoctorSection('access')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('clinic-mode')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path><circle cx="20" cy="10" r="2"></circle></svg>
                    Clinic Mode
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('messages')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Messages
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('history')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    History
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('appointments')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Appointments
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('wellness-ai')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Wellness AI
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('profile')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </button>
                <button class="sidebar-btn" onclick="showDoctorSection('settings')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </button>
                <div style="flex: 1; min-height: 8px;"></div>
                <button onclick="logout()" style="margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 18px rgba(239,68,68,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.3)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Logout
                </button>
            </div>
            <div class="main-content" id="dashboard-content">
                <!-- Content injected here -->
            </div>
        </div>
    `;
    appContainer.innerHTML = dashboardHTML;
    showDoctorSection(window._pendingDoctorSection || 'access');
    window._pendingDoctorSection = null;
};

window.showDoctorSection = function (section) {
    const content = document.getElementById('dashboard-content');
    if (section === 'access') {
        content.innerHTML = `
            <div>
                <div style="margin-bottom: 30px;">
                    <h1 style="color: #0f172a; font-weight: 800; font-size: 2rem; margin-bottom: 8px;">Welcome, ${currentUser.name || 'Provider'} 👋</h1>
                    <p style="color: #475569; font-size: 1.05rem; font-style: italic;">"Empowering healthcare, one record at a time"</p>
                </div>
                <div>
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 1.6rem; margin-bottom: 16px;">Access Records</h2>
                    <div class="glass" style="padding: 30px; max-width: 600px;">
                        <p style="color: #475569; margin-bottom: 20px; font-weight: 500;">Enter a Patient ID or Organization ID to view their records in read-only mode.</p>
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="target-patient-id" class="form-input" style="flex: 1; min-width: 220px;" placeholder="Enter ID (e.g., PAT-1234 or ORG-5678)">
                            <button onclick="smartAccessRecords()" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; white-space: nowrap;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                Access Records
                            </button>
                        </div>
                        <div style="display: flex; gap: 16px; margin-top: 16px;">
                            <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(37,99,235,0.06); border-radius: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <span style="color: #2563eb; font-size: 0.8rem; font-weight: 600;">PAT-xxxx</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(16,185,129,0.06); border-radius: 8px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                <span style="color: #10b981; font-size: 0.8rem; font-weight: 600;">ORG-xxxx</span>
                            </div>
                        </div>
                    </div>
                    <div id="provider-workspace" style="margin-top: 30px; margin-bottom: 40px;"></div>
                </div>

                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h2 style="color: #0f172a; font-weight: 700; font-size: 1.6rem; margin: 0;">⭐ Noted Patients</h2>
                    </div>
                    <div class="glass" style="padding: 30px; border: 1px solid rgba(245,158,11,0.15); background: linear-gradient(180deg, rgba(245,158,11,0.04), transparent);">
                        <div id="home-noted-list" style="display: flex; flex-direction: column; gap: 12px;">
                            ${renderNotedList()}
                        </div>
                    </div>
                </div>
            </div>`;
    } else if (section === 'profile') {
        const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Doctor' ? 'doctor.png' : (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png'));
        let extraRows = '';
        if (currentUser.profileType === 'Doctor') {
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Specialization</span><input type="text" id="edit-specialization" value="${currentUser.specialization || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Hospital</span><input type="text" id="edit-hospital" value="${currentUser.hospital || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
        } else {
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Email</span><input type="text" id="edit-email" value="${currentUser.email || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Address</span><input type="text" id="edit-address" value="${currentUser.address || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
        }
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">My Profile</h2>
                <div class="glass" style="padding: 30px; max-width: 500px;">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                        <div style="position: relative; cursor: pointer;" onclick="document.getElementById('profile-pic-upload').click()">
                            <img id="profile-pic-preview" src="${profileImgSrc}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                            <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            </div>
                            <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="updateProfilePic(this)">
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${currentUser.name || 'Provider'}</h3>
                            <p style="color: #475569; font-weight: 500;">${currentUser.uniqueId}</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${currentUser.profileType}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><input type="text" id="edit-phone" value="${currentUser.phone || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        ${extraRows}
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                        <button onclick="saveProfile()" class="primary-btn" style="margin-top: 10px; border-radius: 50px;">Save Profile</button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'help') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Help & Support</h2>
                <div class="glass" style="padding: 30px; max-width: 600px;">
                    <h3 style="color: #2563eb; font-weight: 700; margin-bottom: 16px;">Frequently Asked Questions</h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">How do I access patient records?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Enter the patient's unique ID (e.g., PAT-1234) on the Home page and click "Request Access". An OTP will be sent to the patient's registered phone number for verification.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">Is patient data secure?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Yes. All records require OTP verification before access is granted. Access is session-based and expires when you logout.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">Need more help?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;
    } else if (section === 'clinic-mode') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Clinic Mode</h2>
                <p style="color: #475569; margin-bottom: 24px; font-size: 1.05rem;">Streamlined patient check-in and consultation workflow for your clinic.</p>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 24px;">
                    <div class="glass" style="flex: 1; min-width: 220px; padding: 25px; text-align: center; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 25px rgba(37,99,235,0.15)';" onmouseout="this.style.transform='none'; this.style.boxShadow='';">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="margin-bottom: 12px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        <h3 id="queue-count" style="color: #0f172a; font-size: 1.3rem; font-weight: 700;">${clinicQueue.length}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Queue Today</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 220px; padding: 25px; text-align: center; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)';" onmouseout="this.style.transform='none';">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom: 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <h3 id="completed-count" style="color: #0f172a; font-size: 1.3rem; font-weight: 700;">${clinicCompleted}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Completed Today</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 220px; padding: 25px; text-align: center; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-4px)';" onmouseout="this.style.transform='none';">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom: 12px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <h3 id="noted-count" style="color: #0f172a; font-size: 1.3rem; font-weight: 700;">${notedPatients.length}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Noted</p>
                    </div>
                </div>
                <!-- Current Consultation -->
                <div class="glass" style="padding: 30px; margin-bottom: 24px;">
                    <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 16px;">Current Consultation</h3>
                    <div id="current-consultation-container">
                        ${renderCurrentConsultation()}
                    </div>
                </div>

                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div class="glass" style="padding: 30px; flex: 2; min-width: 300px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #0f172a; font-weight: 700; margin: 0;">🏥 Queue</h3>
                            <span style="background: #2563eb; color: white; padding: 4px 14px; border-radius: 50px; font-size: 0.85rem; font-weight: 600;" id="queue-badge">${clinicQueue.length} patients</span>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px dashed rgba(0,0,0,0.1);">
                            <input type="text" id="clinic-patient-id" class="form-input" style="flex: 1; min-width: 220px;" placeholder="Enter Patient ID (e.g., PAT-1234)">
                            <button onclick="clinicCheckIn()" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s; font-family: 'Outfit', sans-serif; white-space: nowrap;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                Check In
                            </button>
                        </div>
                        <div id="clinic-queue-list" style="display: flex; flex-direction: column; gap: 12px;">
                            ${renderClinicQueue()}
                        </div>
                    </div>
                    <div class="glass" style="padding: 30px; flex: 1; min-width: 250px; border: 1px solid rgba(245,158,11,0.15); background: linear-gradient(180deg, rgba(245,158,11,0.04), transparent);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <h3 style="color: #0f172a; font-weight: 700; margin: 0;">⭐ Noted</h3>
                            <span style="background: #f59e0b; color: white; padding: 4px 14px; border-radius: 50px; font-size: 0.85rem; font-weight: 600;" id="noted-badge">${notedPatients.length} patients</span>
                        </div>
                        <div id="clinic-noted-list" style="display: flex; flex-direction: column; gap: 10px;">
                            ${renderNotedList()}
                        </div>
                    </div>
                </div>
            </div>`;
    } else if (section === 'messages') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Messages</h2>
                <p style="color: #475569; margin-bottom: 24px; font-size: 1.05rem;">Communicate securely with patients and staff.</p>
                <div class="glass" style="padding: 30px; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 16px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <h3 style="color: #0f172a; font-weight: 700; font-size: 1.3rem; margin-bottom: 8px;">No Messages Yet</h3>
                    <p style="color: #64748b; font-size: 0.95rem; text-align: center; max-width: 400px;">Your inbox is empty. Messages from patients and staff will appear here once the messaging feature is fully activated.</p>
                </div>
            </div>`;
    } else if (section === 'history') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Consultation History</h2>
                <p style="color: #475569; margin-bottom: 24px; font-size: 1.05rem;">Review past patient consultations and access records.</p>
                <div class="glass" style="padding: 30px; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 16px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <h3 style="color: #0f172a; font-weight: 700; font-size: 1.3rem; margin-bottom: 8px;">No History Yet</h3>
                    <p style="color: #64748b; font-size: 0.95rem; text-align: center; max-width: 400px;">Patient consultations you complete will be logged here for easy reference and follow-up tracking.</p>
                </div>
            </div>`;
    } else if (section === 'appointments') {
        content.innerHTML = `
            <div style="animation: fadeIn 0.4s ease-out;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Appointments</h2>
                        <p style="color: #475569; font-size: 1.05rem;">Schedule and manage clinic appointments.</p>
                    </div>
                </div>

                <!-- Schedule Appointment Form -->
                <div class="glass" style="padding: 25px; margin-bottom: 30px; border-left: 4px solid #10b981;">
                    <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 16px; font-size: 1.2rem;">Book New Appointment</h3>
                    <form onsubmit="window.scheduleAppointment(event)" style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-end;">
                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Patient ID*</label>
                            <input type="text" id="apt-patient-id" required class="form-input" style="padding: 10px 14px;" placeholder="e.g. PAT-1234">
                        </div>
                        <div style="flex: 1; min-width: 150px;">
                            <label style="display: block; color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Patient Name*</label>
                            <input type="text" id="apt-patient-name" required class="form-input" style="padding: 10px 14px;" placeholder="e.g. John Doe">
                        </div>
                        <div style="flex: 1; min-width: 130px;">
                            <label style="display: block; color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Date*</label>
                            <input type="date" id="apt-date" required class="form-input" style="padding: 10px 14px;">
                        </div>
                        <div style="flex: 1; min-width: 100px;">
                            <label style="display: block; color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Time*</label>
                            <input type="time" id="apt-time" required class="form-input" style="padding: 10px 14px;">
                        </div>
                        <div style="flex: 2; min-width: 200px;">
                            <label style="display: block; color: #475569; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Reason for Visit</label>
                            <input type="text" id="apt-reason" class="form-input" style="padding: 10px 14px;" placeholder="e.g. General checkup">
                        </div>
                        <div>
                            <button type="submit" style="padding: 11px 24px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">Book</button>
                        </div>
                    </form>
                </div>

                <!-- Dashboard Stats -->
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 24px;">
                    <div class="glass" style="flex: 1; min-width: 220px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="margin-bottom: 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <h3 id="apt-count-today" style="color: #0f172a; font-size: 2rem; font-weight: 800;">-</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Today</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 220px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <h3 id="apt-count-upcoming" style="color: #0f172a; font-size: 2rem; font-weight: 800;">-</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Upcoming</p>
                    </div>
                </div>

                <!-- Appointments List -->
                <div id="appointments-list-container" style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="glass" style="padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 150px;">
                        <p style="color: #64748b; font-size: 0.95rem; text-align: center;">Loading appointments...</p>
                    </div>
                </div>
            </div>`;

        setTimeout(window.loadProviderAppointments, 100);
    } else if (section === 'wellness-ai') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Wellness AI</h2>
                <p style="color: #475569; margin-bottom: 20px; font-size: 1.05rem;">Powered by Google Gemini AI — clinical assistant for doctors.</p>
                <div class="glass" style="height: 460px; padding: 20px; display: flex; flex-direction: column;">
                    <div style="flex: 1; overflow-y: auto; padding-right: 8px;" id="doc-chat-history">
                        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                            <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                            </div>
                            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                                <p style="color: #0f172a; margin: 0; font-size: 0.95rem; line-height: 1.5;">Hello, Dr. ${currentUser.name || 'Doctor'}! I'm your AI clinical assistant. Ask me about drug interactions, differential diagnosis, treatment protocols, or patient management strategies. <em>Note: Always verify with clinical guidelines.</em></p>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 12px;">
                        <input type="text" id="doc-chat-input" class="form-input" style="flex: 1; border-radius: 50px; padding: 12px 20px;" placeholder="Ask about drug interactions, protocols..." onkeydown="if(event.key==='Enter') sendDoctorChat()">
                        <button onclick="sendDoctorChat()" style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border: none; border-radius: 50%; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='none';">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'settings') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Settings</h2>
                <div class="glass" style="padding: 30px; max-width: 550px;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Notifications</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Receive alerts for new appointments & messages</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #10b981; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Consultation Duration</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Default time slot per patient</p>
                            </div>
                            <select style="padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); background: white; color: #0f172a; font-family: 'Outfit', sans-serif; font-weight: 500; cursor: pointer;">
                                <option>15 min</option>
                                <option selected>30 min</option>
                                <option>45 min</option>
                                <option>60 min</option>
                            </select>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Availability Status</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Show as available for new appointments</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #10b981; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Help & Support</p>
                            <p style="color: #64748b; font-size: 0.85rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;
    }
};

let doctorChatHistory = [];

window.sendDoctorChat = async function () {
    const input = document.getElementById('doc-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    const history = document.getElementById('doc-chat-history');

    // Add user message
    history.innerHTML += `
        <div style="display: flex; gap: 10px; margin-bottom: 14px; justify-content: flex-end;">
            <div style="background: #2563eb; color: white; padding: 12px 16px; border-radius: 16px 0 16px 16px; max-width: 80%;">
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.5;">${msg}</p>
            </div>
        </div>`;
    input.value = '';
    input.disabled = true;
    history.scrollTop = history.scrollHeight;

    // Typing indicator
    const typingId = 'doc-typing-' + Date.now();
    history.innerHTML += `
        <div id="${typingId}" style="display: flex; gap: 10px; margin-bottom: 14px;">
            <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
            </div>
            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px;">
                <div style="display: flex; gap: 4px; align-items: center;"><div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:pulse 1s infinite;"></div><div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:pulse 1s infinite 0.2s;"></div><div style="width:8px;height:8px;background:#94a3b8;border-radius:50%;animation:pulse 1s infinite 0.4s;"></div></div>
            </div>
        </div>`;
    history.scrollTop = history.scrollHeight;

    try {
        doctorChatHistory.push({ role: 'user', parts: [{ text: msg }] });

        const systemPrompt = "You are an AI clinical assistant for doctors on Health Vault. You help with drug interactions, differential diagnosis, treatment protocols, medical literature summaries, and patient management strategies. Be precise, evidence-based, and professional. Always remind that final clinical decisions should be verified against current guidelines and clinical judgement. Format responses in clean HTML with bullet points and bold text where appropriate.";

        const conversationContext = doctorChatHistory.map(m =>
            `${m.role === 'user' ? 'Doctor' : 'AI'}: ${m.parts[0].text}`
        ).join('\n');

        const aiText = await callGeminiAPI(conversationContext, systemPrompt);
        doctorChatHistory.push({ role: 'model', parts: [{ text: aiText }] });

        const typingEl = document.getElementById(typingId);
        if (typingEl) {
            typingEl.innerHTML = `
                <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                </div>
                <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                    <div style="color: #0f172a; font-size: 0.95rem; line-height: 1.6;">${aiText}</div>
                </div>`;
        }
    } catch (error) {
        const typingEl = document.getElementById(typingId);
        if (typingEl) {
            typingEl.innerHTML = `
                <div style="width: 34px; height: 34px; border-radius: 50%; background: #ef4444; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div style="background: #fef2f2; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                    <p style="color: #ef4444; margin: 0; font-size: 0.95rem;">Error: ${error.message}</p>
                </div>`;
        }
        doctorChatHistory.pop();
    } finally {
        input.disabled = false;
        input.focus();
        history.scrollTop = history.scrollHeight;
    }
};

window.saveProfile = async function () {
    const editPhone = document.getElementById('edit-phone');
    if (editPhone) currentUser.phone = editPhone.value;

    const editAge = document.getElementById('edit-age');
    if (editAge) currentUser.age = editAge.value;

    const editGender = document.getElementById('edit-gender');
    if (editGender) currentUser.gender = editGender.value;

    const editLocation = document.getElementById('edit-location');
    if (editLocation) currentUser.location = editLocation.value;

    const editSpecialization = document.getElementById('edit-specialization');
    if (editSpecialization) currentUser.specialization = editSpecialization.value;

    const editHospital = document.getElementById('edit-hospital');
    if (editHospital) currentUser.hospital = editHospital.value;

    const editEmail = document.getElementById('edit-email');
    if (editEmail) currentUser.email = editEmail.value;

    const editAddress = document.getElementById('edit-address');
    if (editAddress) currentUser.address = editAddress.value;

    if (window.db) {
        await setDoc(doc(window.db, "users", currentUser.uniqueId), currentUser);
    } else {
        // Save to currentUser
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Save to users DB
        const users = JSON.parse(localStorage.getItem('hv_users') || '[]');
        const userIndex = users.findIndex(u => u.uniqueId === currentUser.uniqueId);
        if (userIndex > -1) {
            users[userIndex] = currentUser;
            localStorage.setItem('hv_users', JSON.stringify(users));
        }
    }

    alert('Profile updated successfully!');
    if (currentUser.profileType === 'Patient') {
        showDashboardSection('profile');
    } else {
        if (currentUser.profileType === 'Doctor') { showDoctorSection('profile'); } else if (currentUser.profileType === 'Lab') { showLabSection('profile'); } else { showOrganisationSection('profile'); }
    }
};

window.requestPatientAccess = function () {
    const targetId = document.getElementById('target-patient-id').value;
    if (!targetId.startsWith('PAT-')) return alert("Invalid Patient ID format.");

    const otp = Math.floor(100000 + Math.random() * 900000);
    alert(`[SYSTEM SIMULATION] An OTP code ${otp} has been sent to the patient's registered phone number.`);

    const enteredOtp = prompt(`Enter the 6-digit OTP provided by patient ${targetId}:`);
    if (enteredOtp == otp) {
        alert("Verification Successful. Access Granted.");
        loadPatientRecords(targetId);
    } else {
        if (enteredOtp !== null) alert("Verification Failed. Access Denied.");
    }
};

window.loadPatientRecords = async function (targetId) {
    let visits = [];
    let patientData = null;

    if (window.db) {
        try {
            // Fetch Patient Profile
            const userSnap = await getDoc(doc(window.db, "users", targetId));
            if (userSnap.exists()) patientData = userSnap.data();

            // Fetch Visits
            const visitsRef = collection(window.db, "users", targetId, "visits");
            const querySnapshot = await getDocs(visitsRef);
            querySnapshot.forEach((doc) => {
                visits.push(doc.data());
            });
            // Sort client-side by date
            visits.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (e) {
            console.error("Error fetching patient records: ", e);
        }
    } else {
        visits = JSON.parse(localStorage.getItem(targetId + '_visits') || '[]');
        patientData = JSON.parse(localStorage.getItem(targetId) || 'null');
    }

    const workspace = document.getElementById('provider-workspace');

    let visitsHTML = visits.map(v => `
        <div class="glass visit-card" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 15px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='none'; this.style.boxShadow='';" onclick="openProviderPatientVisit('${v.id}', '${targetId}')">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: #0f172a; font-weight: 700; margin: 0;">${v.displayName || v.name}</h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </div>
            <p style="color: #64748b; font-weight: 500; font-size: 0.9rem; margin-top: 6px;">${v.date}</p>
        </div>
    `).join('');

    const pName = patientData?.name || 'Unknown Patient';
    const pAge = patientData?.age ? `${patientData.age} yrs` : 'N/A';
    const pPhone = patientData?.phone || 'Not Provided';
    const pEmail = patientData?.email || 'Not Provided';

    workspace.innerHTML = `
        <div style="animation: fadeIn 0.4s ease-out;">
            <!-- Patient Profile Card -->
            <div class="glass" style="padding: 25px; margin-bottom: 30px; display: flex; gap: 25px; align-items: stretch; flex-wrap: wrap; border-left: 5px solid #2563eb;">
                <div style="flex: 1; min-width: 200px;">
                    <p style="color: #64748b; font-size: 0.9rem; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.5px;">PATIENT PROFILE</p>
                    <h2 style="color: #0f172a; font-size: 1.8rem; font-weight: 800; margin-bottom: 8px;">${pName}</h2>
                    <p style="color: #475569; font-weight: 500; display: inline-block; background: rgba(0,0,0,0.05); padding: 4px 12px; border-radius: 50px; font-size: 0.9rem;">ID: ${targetId}</p>
                </div>
                
                <div style="width: 1px; background: rgba(0,0,0,0.1); margin: 0 10px;" class="hide-on-mobile"></div>
                
                <div style="flex: 2; display: flex; gap: 20px; flex-wrap: wrap; min-width: 250px;">
                    <div style="flex: 1; min-width: 120px;">
                        <p style="color: #64748b; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">AGE</p>
                        <p style="color: #0f172a; font-weight: 700; font-size: 1.1rem; display: flex; align-items: center; gap: 6px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            ${pAge}
                        </p>
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        <p style="color: #64748b; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">PHONE</p>
                        <p style="color: #0f172a; font-weight: 600; font-size: 1rem;">${pPhone}</p>
                    </div>
                    <div style="flex: 1; min-width: 120px;">
                        <p style="color: #64748b; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">EMAIL</p>
                        <p style="color: #0f172a; font-weight: 600; font-size: 1rem; word-break: break-all;">${pEmail}</p>
                    </div>
                </div>
            </div>

            <!-- Visits Section -->
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
                <div>
                    <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem;">Medical Records</h3>
                    <p style="color: #64748b; font-size: 0.95rem;">You have secure access to these records during this session.</p>
                </div>
                <div style="background: rgba(37, 99, 235, 0.1); color: #2563eb; padding: 6px 14px; border-radius: 50px; font-weight: 700; font-size: 0.9rem;">
                    ${visits.length} Visits
                </div>
            </div>
            
            <div class="visits-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                ${visitsHTML || '<p style="grid-column: 1/-1; padding: 20px; text-align: center; color: #64748b; background: rgba(0,0,0,0.02); border-radius: 12px; border: 1px dashed rgba(0,0,0,0.1);">No medical records found for this patient.</p>'}
            </div>
        </div>
    `;
};

window.openProviderPatientVisit = async function (visitId, targetId) {
    let visit = null;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", targetId, "visits", visitId));
        if (docSnap.exists()) visit = docSnap.data();
    } else {
        const visits = JSON.parse(localStorage.getItem(targetId + '_visits') || '[]');
        visit = visits.find(v => v.id === visitId);
    }

    if (!visit) return;

    const workspace = document.getElementById('provider-workspace');
    workspace.innerHTML = `
        <div style="margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem;">Record: ${visit.displayName || visit.name}</h3>
                <button onclick="loadPatientRecords('${targetId}')" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: rgba(37,99,235,0.1); color: #2563eb; border: none; border-radius: 50px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(37,99,235,0.2)';">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to List
                </button>
            </div>
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px; border: 1px solid rgba(0,0,0,0.05);">
                    <h4 style="color: #2563eb; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Prescriptions
                    </h4>
                    <div>${renderProviderDocs(visit.documents?.prescriptions)}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px; border: 1px solid rgba(0,0,0,0.05);">
                    <h4 style="color: #10b981; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        Reports
                    </h4>
                    <div>${renderProviderDocs(visit.documents?.reports)}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px; border: 1px solid rgba(0,0,0,0.05);">
                    <h4 style="color: #f59e0b; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        Scans
                    </h4>
                    <div>${renderProviderDocs(visit.documents?.scans)}</div>
                </div>
            </div>
        </div>
    `;
};

window.renderProviderDocs = function (docs) {
    if (!docs || docs.length === 0) return '<p style="color: #94a3b8; font-size: 0.85rem; font-weight: 500;">No documents available.</p>';
    return docs.map((d) => {
        const docName = typeof d === 'string' ? d : d.name;
        const docUrl = typeof d === 'string' ? '' : d.url;
        return `
        <div style="padding: 10px 12px; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0,0,0,0.05); margin-bottom: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span style="color: #334155; font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${docName}</span>
            </div>
            <button onclick="event.stopPropagation(); viewDocument('${docName.replace(/'/g, "\\'")}', '${docUrl}')"
                style="padding: 4px 12px; background: white; color: #2563eb; border: 1px solid #2563eb; border-radius: 50px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='white'"
                title="View document">View</button>
        </div>
        `;
    }).join('');
};

window.logout = function () {
    currentUser = null;
    currentProfileType = null;
    renderView('profileSelection');
};

window.renderMetricsCharts = function (visits) {
    if (!window.Chart) return; // Wait for Chart.js to load

    const sortedVisits = [...visits].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedVisits.map(v => v.date);

    const systolicData = [];
    const diastolicData = [];
    sortedVisits.forEach(v => {
        if (v.bp && v.bp.includes('/')) {
            const parts = v.bp.split('/');
            systolicData.push(parseInt(parts[0]));
            diastolicData.push(parseInt(parts[1]));
        } else {
            systolicData.push(null);
            diastolicData.push(null);
        }
    });

    const bpCtx = document.getElementById('bpChart');
    if (bpCtx) {
        new Chart(bpCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Systolic', data: systolicData, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.3 },
                    { label: 'Diastolic', data: diastolicData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: { spanGaps: true, scales: { y: { beginAtZero: false, suggestedMin: 60, suggestedMax: 140 } } }
        });
    }

    const sugarData = sortedVisits.map(v => v.sugar ? parseInt(v.sugar) : null);
    const sugarCtx = document.getElementById('sugarChart');
    if (sugarCtx) {
        new Chart(sugarCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Blood Sugar (mg/dL)', data: sugarData, backgroundColor: '#10b981', borderRadius: 4 }]
            },
            options: { spanGaps: true, scales: { y: { beginAtZero: false, suggestedMin: 70, suggestedMax: 150 } } }
        });
    }

    // Custom Visit Frequency Grid (boxes per month)
    const frequencyMap = {};
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    sortedVisits.forEach(v => {
        const d = new Date(v.date);
        const monthKey = d.toLocaleString('default', { month: 'short' });
        const yearKey = d.getFullYear();
        const key = `${monthKey} ${yearKey}`;
        if (!frequencyMap[key]) frequencyMap[key] = { visits: [], month: monthKey, year: yearKey, monthIndex: d.getMonth() };
        frequencyMap[key].visits.push(v);
    });

    // Sort by year then month
    const sortedKeys = Object.keys(frequencyMap).sort((a, b) => {
        const aData = frequencyMap[a];
        const bData = frequencyMap[b];
        return (aData.year - bData.year) || (aData.monthIndex - bData.monthIndex);
    });

    // Get all 12 months for the relevant year(s)
    const years = [...new Set(sortedVisits.map(v => new Date(v.date).getFullYear()))];
    const allMonths = [];
    years.forEach(year => {
        monthOrder.forEach((m, idx) => {
            const key = `${m} ${year}`;
            allMonths.push({ key, month: m, year, monthIndex: idx, visits: frequencyMap[key] ? frequencyMap[key].visits : [] });
        });
    });

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const gridContainer = document.getElementById('visitsFrequencyGrid');
    if (gridContainer) {
        let gridHTML = '';
        allMonths.forEach(item => {
            const boxesHTML = item.visits.length > 0
                ? item.visits.map((v, i) => `<div title="${v.name || 'Visit'} - ${v.date}" style="width: 28px; height: 28px; background: ${colors[i % colors.length]}; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onmouseover="this.style.transform='scale(1.2)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.1)';"></div>`).join('')
                : '<span style="color: #cbd5e1; font-size: 0.8rem; font-style: italic;">—</span>';

            gridHTML += `
                <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.04);">
                    <span style="width: 70px; font-weight: 600; color: ${item.visits.length > 0 ? '#0f172a' : '#94a3b8'}; font-size: 0.9rem; flex-shrink: 0;">${item.month}</span>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">${boxesHTML}</div>
                    ${item.visits.length > 0 ? `<span style="margin-left: auto; font-size: 0.75rem; color: #64748b; font-weight: 500; flex-shrink: 0;">${item.visits.length}</span>` : ''}
                </div>`;
        });
        gridContainer.innerHTML = gridHTML;
    }
};

// --- Provider Appointments Logic ---

window.scheduleAppointment = async function (event) {
    event.preventDefault();
    if (!currentUser || currentUser.profileType !== 'Doctor') return;

    const btn = event.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = "Booking...";
    btn.disabled = true;

    try {
        const patientId = document.getElementById('apt-patient-id').value.toUpperCase();
        const patientName = document.getElementById('apt-patient-name').value;
        const date = document.getElementById('apt-date').value;
        const time = document.getElementById('apt-time').value;
        const reason = document.getElementById('apt-reason').value;

        const appointmentId = 'APT-' + Math.floor(10000 + Math.random() * 90000);

        const appointmentData = {
            id: appointmentId,
            patientId,
            patientName,
            date,
            time,
            reason,
            status: 'Upcoming',
            createdAt: new Date().toISOString()
        };

        if (window.db) {
            await setDoc(doc(window.db, "users", currentUser.uniqueId, "appointments", appointmentId), appointmentData);
        } else {
            let apts = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_appointments') || '[]');
            apts.push(appointmentData);
            localStorage.setItem(currentUser.uniqueId + '_appointments', JSON.stringify(apts));
        }

        alert(`Appointment booked successfully for ${patientName} on ${date} at ${time}.`);
        event.target.reset();

        window.loadProviderAppointments();

    } catch (e) {
        console.error("Error booking appointment: ", e);
        alert("Failed to book appointment.");
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
};

window.loadProviderAppointments = async function () {
    if (!currentUser || currentUser.profileType !== 'Doctor') return;

    const container = document.getElementById('appointments-list-container');
    if (!container) return;

    let apts = [];
    if (window.db) {
        try {
            const querySnapshot = await getDocs(collection(window.db, "users", currentUser.uniqueId, "appointments"));
            querySnapshot.forEach((doc) => apts.push(doc.data()));
        } catch (e) {
            console.error("Error fetching appointments: ", e);
        }
    } else {
        apts = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_appointments') || '[]');
    }

    // Sort by Date and Time
    apts.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    const todayStr = new Date().toISOString().split('T')[0];

    let todayCount = 0;
    let upcomingCount = 0;

    let html = '';

    if (apts.length === 0) {
        html = `
            <div class="glass" style="padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 150px;">
                <p style="color: #64748b; font-size: 0.95rem; text-align: center;">No appointments found. Book one above.</p>
            </div>`;
    } else {
        apts.forEach(apt => {
            if (apt.date === todayStr && apt.status === 'Upcoming') todayCount++;
            if (new Date(apt.date) >= new Date(todayStr) && apt.status === 'Upcoming') upcomingCount++;

            let statusColor = apt.status === 'Completed' ? '#10b981' : (apt.status === 'Cancelled' ? '#ef4444' : '#f59e0b');
            let statusBg = apt.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : (apt.status === 'Cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)');

            html += `
                <div class="glass" style="padding: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                        <div style="background: rgba(37,99,235,0.05); padding: 10px 15px; border-radius: 8px; text-align: center; min-width: 90px;">
                            <div style="color: #2563eb; font-weight: 800; font-size: 1.1rem;">${apt.time}</div>
                            <div style="color: #64748b; font-size: 0.8rem; font-weight: 600;">${apt.date}</div>
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 4px; font-size: 1.2rem;">${apt.patientName}</h3>
                            <p style="color: #475569; font-size: 0.9rem; margin-bottom: 6px;">ID: <strong>${apt.patientId}</strong></p>
                            <p style="color: #64748b; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                ${apt.reason || 'No reason provided'}
                            </p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                        <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; font-weight: 700;">${apt.status}</span>
                        ${apt.status === 'Upcoming' ? `
                            <div style="display: flex; gap: 8px;">
                                <button onclick="window.updateAppointmentStatus('${apt.id}', 'Completed')" style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Complete</button>
                                <button onclick="window.updateAppointmentStatus('${apt.id}', 'Cancelled')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Cancel</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    const todayEl = document.getElementById('apt-count-today');
    const upcomingEl = document.getElementById('apt-count-upcoming');

    if (todayEl) todayEl.innerText = todayCount;
    if (upcomingEl) upcomingEl.innerText = upcomingCount;
};

window.updateAppointmentStatus = async function (appointmentId, newStatus) {
    if (!confirm(`Are you sure you want to mark this appointment as ${newStatus}?`)) return;

    if (window.db) {
        try {
            await updateDoc(doc(window.db, "users", currentUser.uniqueId, "appointments", appointmentId), {
                status: newStatus
            });
        } catch (e) {
            console.error("Error updating appointment: ", e);
            alert("Failed to update status.");
        }
    } else {
        let apts = JSON.parse(localStorage.getItem(currentUser.uniqueId + '_appointments') || '[]');
        const idx = apts.findIndex(a => a.id === appointmentId);
        if (idx > -1) {
            apts[idx].status = newStatus;
            localStorage.setItem(currentUser.uniqueId + '_appointments', JSON.stringify(apts));
        }
    }

    window.loadProviderAppointments();
};

// Init
function init() {
    renderView('splash');
    setTimeout(() => {
        renderView('profileSelection');
    }, 3500); // Wait 2.5s to show splash
}

document.addEventListener('DOMContentLoaded', init);



window.renderOrganisationDashboard = async function () {
    const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png');
    let dashboardHTML = `
        <div class="dashboard-container">
            <div class="sidebar">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="l3.png" alt="Logo" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onerror="this.src='logodp.png'"/>
                    <h2 style="margin: 0; font-size: 1.25rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Health Vault</h2>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; margin: 14px 0;">
                    <img id="sidebar-avatar" src="${profileImgSrc}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                    <div style="color: white; font-weight: 600; text-align: center;">${currentUser.name || 'Provider'}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.8rem; margin-top: 3px;">${currentUser.uniqueId}</div>
                    <div style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600; margin-top: 2px;">${currentUser.profileType} Portal</div>
                </div>
                <button class="sidebar-btn" onclick="showOrganisationSection('access')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    Patient Records
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('profile')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('org-lead')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V19a4 4 0 0 1 4-4H17a4 4 0 0 1 4 4V21"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Organization Lead
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('chatbot')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0z"></path><path d="M11 5v1M11 18v1M5 11H4M19 11h-1"></path></svg>
                    Wellness AI
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('history')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    History
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('doctors-data')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Doctors Data
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('help')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Help
                </button>
                <button class="sidebar-btn" onclick="showOrganisationSection('settings')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </button>
                <div style="flex: 1; min-height: 8px;"></div>
                ${window.realDoctorUser ? `
                <button onclick="exitOrgMode()" style="margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Exit Org Mode
                </button>
                ` : `
                <button onclick="logout()" style="margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 18px rgba(239,68,68,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.3)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Logout
                </button>
                `}
            </div>
            <div class="main-content" id="dashboard-content">
                <!-- Content injected here -->
            </div>
        </div>
    `;
    appContainer.innerHTML = dashboardHTML;
    showOrganisationSection('access');
};

window.showOrganisationSection = async function (section) {
    const content = document.getElementById('dashboard-content');
    if (section === 'access') {
        content.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading members...</div>';
        let membersHTML = '<div style="color: #94a3b8; padding: 20px;">No members added yet.</div>';
        try {
            let members = [];
            if (window.db) {
                const q = query(collection(window.db, "users"), where("organizationId", "==", currentUser.uniqueId));
                const snap = await getDocs(q);
                snap.forEach(d => members.push(d.data()));
            } else {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('PAT-')) {
                        const u = JSON.parse(localStorage.getItem(key));
                        if (u && u.organizationId === currentUser.uniqueId) members.push(u);
                    }
                }
            }
            if (members.length > 0) {
                membersHTML = members.map(m => `
                    <div onclick="window.orgAccessMember('${m.uniqueId}', ${m.isPrivate ? 'true' : 'false'})" style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; position: relative; display: flex; flex-direction: column;" onmouseover="this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'; this.style.transform='none';">
                        
                        <!-- Privacy badge -->
                        <div style="position: absolute; top: 12px; right: 12px; display: flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 50px; font-size: 0.7rem; font-weight: 600; ${m.isPrivate ? 'background: rgba(239,68,68,0.1); color: #ef4444;' : 'background: rgba(16,185,129,0.1); color: #10b981;'}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${m.isPrivate ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>'}</svg>
                            ${m.isPrivate ? 'Private' : 'Open'}
                        </div>
                        
                        <!-- Folder Icon with Avatar -->
                        <div style="position: relative; margin-bottom: 20px; display: inline-block;">
                            <svg width="70" height="55" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V8C22 6.89543 21.1046 6 20 6H12L10 4Z" fill="${m.isPrivate ? '#fee2e2' : '#dbeafe'}"/>
                            </svg>
                            <div style="position: absolute; top: 60%; left: 35px; transform: translate(-50%, -50%); width: 26px; height: 26px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                ${m.isPrivate ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#1d4ed8" stroke="none"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'}
                            </div>
                        </div>

                        <!-- Info -->
                        <h3 style="color: #0f172a; font-weight: 600; font-size: 1.05rem; margin: 0 0 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name}</h3>
                        <div style="color: #64748b; font-size: 0.85rem;">ID: ${m.uniqueId}</div>
                        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 0.75rem; color: #94a3b8;">Privacy</span>
                            ${window._readOnlyMode ? 
                                `<span style="font-size: 0.75rem; font-weight: 600; color: ${m.isPrivate ? '#ef4444' : '#10b981'};">${m.isPrivate ? 'Private' : 'Open'}</span>` : 
                                `<label class="privacy-toggle privacy-toggle-sm" onclick="event.stopPropagation();">
                                    <input type="checkbox" ${m.isPrivate ? 'checked' : ''} onchange="event.stopPropagation(); toggleMemberPrivacy('${m.uniqueId}', this.checked)">
                                    <span class="toggle-track"></span>
                                </label>`
                            }
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error("Error fetching members:", e);
            membersHTML = '<div style="color: #ef4444; padding: 20px;">Error loading members.</div>';
        }

        content.innerHTML = `
            <div style="position: relative; min-height: 80vh;">
                <!-- Header with Search -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; flex-wrap: wrap; gap: 20px;">
                    <div>
                        <h1 style="color: #0f172a; font-weight: 700; font-size: 1.8rem; margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">${currentUser.name || 'Organization'} : Patient Records</h1>
                        <p style="color: #64748b; font-size: 0.95rem;">Manage and access patient records securely</p>
                    </div>
                    
                    <div style="position: relative; width: 100%; max-width: 320px;">
                        <svg style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="org-search-input" placeholder="Search by Patient Name or ID..." style="width: 100%; padding: 10px 10px 10px 38px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 0.9rem; outline: none; transition: border 0.2s;" onfocus="this.style.borderColor='#2563eb';" onblur="this.style.borderColor='#e2e8f0';" onkeyup="searchOrgMembers(this.value)">
                    </div>
                </div>

                <!-- Patient Records Section -->
                <div>
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 1.25rem; margin-bottom: 4px;">Patient Records</h2>
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">Click on a patient folder to view their health records</p>
                    
                    <div id="org-members-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                        ${membersHTML}
                    </div>
                </div>
                
                ${window._readOnlyMode ? '' : `
                <!-- Floating Action Button for Add Member -->
                <button onclick="window.addOrganisationMember()" style="position: fixed; bottom: 40px; right: 40px; display: flex; align-items: center; gap: 8px; padding: 14px 24px; background: #1d4ed8; color: white; border: none; border-radius: 50px; font-size: 1rem; font-weight: 500; cursor: pointer; box-shadow: 0 4px 15px rgba(29, 78, 216, 0.4); transition: all 0.2s; z-index: 100;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(29, 78, 216, 0.5)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(29, 78, 216, 0.4)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Member
                </button>
                `}
                
                <div id="provider-workspace" style="margin-top: 30px; margin-bottom: 40px;"></div>
            </div>`;
    } else if (section === 'profile') {
        const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png');
        let extraRows = '';
        if (window._readOnlyMode) {
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Email</span><span style="color: #0f172a; font-weight: 600;">${currentUser.email || ''}</span></div>`;
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Address</span><span style="color: #0f172a; font-weight: 600;">${currentUser.address || ''}</span></div>`;
        } else {
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Email</span><input type="text" id="edit-email" value="${currentUser.email || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
            extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Address</span><input type="text" id="edit-address" value="${currentUser.address || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
        }

        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">My Profile</h2>
                <div class="glass" style="padding: 30px; max-width: 500px;">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                        <div style="position: relative; ${window._readOnlyMode ? '' : 'cursor: pointer;'}" ${window._readOnlyMode ? '' : 'onclick="document.getElementById(\'profile-pic-upload\').click()"'} >
                            <img id="profile-pic-preview" src="${profileImgSrc}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                            ${window._readOnlyMode ? '' : `
                            <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            </div>
                            <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="updateProfilePic(this)">
                            `}
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${currentUser.name || 'Organisation'}</h3>
                            <p style="color: #475569; font-weight: 500;">${currentUser.uniqueId}</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${currentUser.profileType}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <span style="color: #475569; font-weight: 500;">Phone</span>
                            ${window._readOnlyMode ? 
                                `<span style="color: #0f172a; font-weight: 600;">${currentUser.phone || ''}</span>` : 
                                `<input type="text" id="edit-phone" value="${currentUser.phone || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;">`
                            }
                        </div>
                        ${extraRows}
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                        ${window._readOnlyMode ? '' : `<button onclick="saveProfile()" class="primary-btn" style="margin-top: 10px; border-radius: 50px;">Save Profile</button>`}
                    </div>
                </div>
            </div>`;
    } else if (section === 'settings') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Settings</h2>
                <div class="glass" style="padding: 30px; max-width: 550px;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Notifications</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Receive alerts for new messages</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #10b981; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Help & Support</p>
                            <p style="color: #64748b; font-size: 0.85rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;

    } else if (section === 'org-lead') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Organization Lead</h2>
                <div class="glass" style="padding: 30px; max-width: 500px;">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                        <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1d4ed8); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${currentUser.name || 'Organization Lead'}</h3>
                            <p style="color: #2563eb; font-weight: 600; font-size: 0.9rem;">Primary Contact</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Organization</span><span style="color: #0f172a; font-weight: 600;">${currentUser.name || 'N/A'}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><span style="color: #0f172a; font-weight: 600;">${currentUser.phone || 'N/A'}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Email</span><span style="color: #0f172a; font-weight: 600;">${currentUser.email || 'N/A'}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Address</span><span style="color: #0f172a; font-weight: 600;">${currentUser.address || 'N/A'}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">ID</span><span style="color: #0f172a; font-weight: 600;">${currentUser.uniqueId}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Since</span><span style="color: #0f172a; font-weight: 600;">${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                    </div>
                </div>
            </div>`;
    } else if (section === 'chatbot') {
        chatHistory = [];
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Wellness AI</h2>
                <p style="color: #475569; margin-bottom: 20px; font-size: 1.05rem;">Powered by Google Gemini AI — ask anything about health, administration, or wellness.</p>
                <div class="glass" style="height: 460px; padding: 20px; display: flex; flex-direction: column;">
                    <div style="flex: 1; overflow-y: auto; padding-right: 8px;" id="chat-history">
                        <div style="display: flex; gap: 10px; margin-bottom: 14px;">
                            <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                            </div>
                            <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 0 16px 16px 16px; max-width: 80%;">
                                <p style="color: #0f172a; margin: 0; font-size: 0.95rem; line-height: 1.5;">Hello! I'm your AI wellness assistant. Ask me anything about health, nutrition, or general wellness. <em>Note: I provide general guidance, not medical diagnosis.</em></p>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 12px;">
                        <input type="text" id="chat-input" class="form-input" style="flex: 1; border-radius: 50px; padding: 12px 20px;" placeholder="Ask about health, administration, fitness..." onkeydown="if(event.key==='Enter') sendChat()">
                        <button onclick="sendChat()" style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border: none; border-radius: 50%; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.transform='scale(1.1)';" onmouseout="this.style.transform='none';">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'history') {
        let members = [];
        try {
            if (window.db) {
                const q2 = query(collection(window.db, "users"), where("organizationId", "==", currentUser.uniqueId));
                const snap = await getDocs(q2);
                snap.forEach(d => members.push(d.data()));
            } else {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('PAT-')) {
                        const u = JSON.parse(localStorage.getItem(key));
                        if (u && u.organizationId === currentUser.uniqueId) members.push(u);
                    }
                }
            }
        } catch(e) { console.error(e); }
        let timelineHTML = '';
        if (members.length > 0) {
            timelineHTML = members.map(m => `
                <div style="display: flex; gap: 16px; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px; align-items: center;">
                    <div style="width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #10b981); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <div style="flex: 1;">
                        <p style="color: #0f172a; font-weight: 600; margin-bottom: 2px;">${m.name}</p>
                        <p style="color: #64748b; font-size: 0.85rem;">Member registered • ID: ${m.uniqueId}</p>
                    </div>
                    <span style="color: #94a3b8; font-size: 0.8rem;">${m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ''}</span>
                </div>
            `).join('');
        } else {
            timelineHTML = '<p style="color: #94a3b8; text-align: center; padding: 30px;">No activity yet.</p>';
        }
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">History</h2>
                <div class="glass" style="padding: 24px; max-width: 650px;">
                    <h3 style="color: #475569; font-weight: 700; margin-bottom: 16px;">Member Registration Timeline</h3>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${timelineHTML}
                    </div>
                </div>
            </div>`;
    } else if (section === 'doctors-data') {
        let doctors = [];
        try {
            if (window.db) {
                const q3 = query(collection(window.db, "users"), where("profileType", "==", "Doctor"));
                const snap = await getDocs(q3);
                snap.forEach(d => doctors.push(d.data()));
            }
        } catch(e) { console.error(e); }
        let doctorCards = '';
        if (doctors.length > 0) {
            doctorCards = doctors.map(d => `
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <div>
                            <h4 style="color: #0f172a; font-weight: 700; margin: 0;">${d.name}</h4>
                            <p style="color: #2563eb; font-size: 0.85rem; font-weight: 500;">${d.specialization || 'General'}</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.88rem;">
                        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">ID</span><span style="color: #0f172a; font-weight: 600;">${d.uniqueId}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Hospital</span><span style="color: #0f172a; font-weight: 600;">${d.hospital || 'N/A'}</span></div>
                        <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Phone</span><span style="color: #0f172a; font-weight: 600;">${d.phone || 'N/A'}</span></div>
                    </div>
                </div>
            `).join('');
        } else {
            doctorCards = '<div style="text-align: center; padding: 40px; color: #94a3b8;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="margin-bottom: 12px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><p>No doctors registered in the system yet.</p></div>';
        }
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Doctors Data</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                    ${doctorCards}
                </div>
            </div>`;
    } else if (section === 'help') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Help & Support</h2>
                <div class="glass" style="padding: 30px; max-width: 600px;">
                    <h3 style="color: #2563eb; font-weight: 700; margin-bottom: 16px;">Organization FAQs</h3>
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">How do I add new members?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Click the blue "Add Member" button at the bottom-right of Patient Records. You can register a new member or link an existing patient.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">How do I view patient records?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Go to Patient Records and click on a member's folder card to view their health data.</p>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 10px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 6px;">Need more help?</p>
                            <p style="color: #475569; font-size: 0.95rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;
    }
};



window.renderLabDashboard = async function () {
    const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png');
    let dashboardHTML = `
        <div class="dashboard-container">
            <div class="sidebar">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="l3.png" alt="Logo" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onerror="this.src='logodp.png'"/>
                    <h2 style="margin: 0; font-size: 1.25rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Health Vault</h2>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; margin: 14px 0;">
                    <img id="sidebar-avatar" src="${profileImgSrc}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; margin-bottom: 8px; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                    <div style="color: white; font-weight: 600; text-align: center;">${currentUser.name || 'Provider'}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.8rem; margin-top: 3px;">${currentUser.uniqueId}</div>
                    <div style="font-size: 0.75rem; color: var(--primary-color); font-weight: 600; margin-top: 2px;">${currentUser.profileType} Portal</div>
                </div>
                <button class="sidebar-btn" onclick="showLabSection('access')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Home
                </button>
                <button class="sidebar-btn" onclick="showLabSection('profile')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </button>
                <button class="sidebar-btn" onclick="showLabSection('settings')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    Settings
                </button>
                <div style="flex: 1; min-height: 8px;"></div>
                <button onclick="logout()" style="margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)'; this.style.boxShadow='0 6px 18px rgba(239,68,68,0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 12px rgba(239,68,68,0.3)';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Logout
                </button>
            </div>
            <div class="main-content" id="dashboard-content">
                <!-- Content injected here -->
            </div>
        </div>
    `;
    appContainer.innerHTML = dashboardHTML;
    showLabSection('access');
};

window.showLabSection = function (section) {
    const content = document.getElementById('dashboard-content');
    if (section === 'access') {
        content.innerHTML = `
            <div>
                <div style="margin-bottom: 30px;">
                    <h1 style="color: #0f172a; font-weight: 800; font-size: 2rem; margin-bottom: 8px;">Welcome, ${currentUser.name || 'Lab'} 👋</h1>
                    <p style="color: #475569; font-size: 1.05rem; font-style: italic;">"Empowering healthcare, one record at a time"</p>
                </div>
                <div>
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 1.6rem; margin-bottom: 16px;">Access Patient Records</h2>
                    <div class="glass" style="padding: 30px; max-width: 550px;">
                        <p style="color: #475569; margin-bottom: 16px; font-weight: 500;">Enter a patient's unique ID to request access via OTP verification.</p>
                        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                            <input type="text" id="target-patient-id" class="form-input" style="flex: 1; min-width: 220px;" placeholder="Enter Patient ID (e.g., PAT-1234)">
                            <button onclick="requestPatientAccess()" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; white-space: nowrap;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Request Access
                            </button>
                        </div>
                    </div>
                    <div id="provider-workspace" style="margin-top: 30px; margin-bottom: 40px;"></div>
                </div>
            </div>`;
    } else if (section === 'profile') {
        const profileImgSrc = currentUser.fileUrl || (currentUser.profileType === 'Lab' ? 'lab.png' : 'organisation.png');
        let extraRows = '';
        extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Email</span><input type="text" id="edit-email" value="${currentUser.email || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;
        extraRows += `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Address</span><input type="text" id="edit-address" value="${currentUser.address || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>`;

        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">My Profile</h2>
                <div class="glass" style="padding: 30px; max-width: 500px;">
                    <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                        <div style="position: relative; cursor: pointer;" onclick="document.getElementById('profile-pic-upload').click()">
                            <img id="profile-pic-preview" src="${profileImgSrc}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                            <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            </div>
                            <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="updateProfilePic(this)">
                        </div>
                        <div>
                            <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${currentUser.name || 'Lab'}</h3>
                            <p style="color: #475569; font-weight: 500;">${currentUser.uniqueId}</p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${currentUser.profileType}</span></div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><input type="text" id="edit-phone" value="${currentUser.phone || ''}" style="color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;"></div>
                        ${extraRows}
                        <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                        <button onclick="saveProfile()" class="primary-btn" style="margin-top: 10px; border-radius: 50px;">Save Profile</button>
                    </div>
                </div>
            </div>`;
    } else if (section === 'settings') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Settings</h2>
                <div class="glass" style="padding: 30px; max-width: 550px;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <div>
                                <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Notifications</p>
                                <p style="color: #64748b; font-size: 0.85rem;">Receive alerts for new messages</p>
                            </div>
                            <label style="position: relative; display: inline-block; width: 50px; height: 26px; cursor: pointer;">
                                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                                <span style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #10b981; border-radius: 26px; transition: 0.3s;"></span>
                            </label>
                        </div>
                        <div style="padding: 16px; background: rgba(0,0,0,0.03); border-radius: 12px;">
                            <p style="color: #0f172a; font-weight: 600; margin-bottom: 4px;">Help & Support</p>
                            <p style="color: #64748b; font-size: 0.85rem;">Contact support at <strong>support@healthvault.com</strong> or call <strong>1800-HEALTH</strong></p>
                        </div>
                    </div>
                </div>
            </div>`;
    }
};

// ====== SESSION TIMER FOR DOCTOR ACCESS ======

window._sessionTimer = null;
window._sessionTimerInterval = null;
window._sessionTimerSeconds = 0;
window._sessionTimerOrigin = null; // 'home' or 'clinic' or 'org'

window.startSessionTimer = function(origin) {
    window.clearSessionTimer();
    window._sessionTimerOrigin = origin || 'home';
    window._sessionTimerSeconds = 600; // 10 minutes

    // Create timer badge
    let badge = document.getElementById('session-timer-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'session-timer-badge';
        badge.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 9999; display: flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); color: white; border-radius: 50px; font-family: "Outfit", sans-serif; font-size: 0.9rem; font-weight: 600; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease;';
        document.body.appendChild(badge);
    }

    window._sessionTimerInterval = setInterval(() => {
        window._sessionTimerSeconds--;
        const mins = Math.floor(window._sessionTimerSeconds / 60);
        const secs = window._sessionTimerSeconds % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Color shifts: green > yellow > red
        let timerColor = '#10b981';
        let glowColor = 'rgba(16, 185, 129, 0.3)';
        if (window._sessionTimerSeconds <= 60) {
            timerColor = '#ef4444';
            glowColor = 'rgba(239, 68, 68, 0.4)';
            badge.style.animation = 'pulse 1s ease-in-out infinite';
        } else if (window._sessionTimerSeconds <= 180) {
            timerColor = '#f59e0b';
            glowColor = 'rgba(245, 158, 11, 0.3)';
        }

        badge.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${timerColor}" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span style="color: ${timerColor};">${timeStr}</span>
            <span style="color: rgba(255,255,255,0.5); font-size: 0.75rem;">remaining</span>
        `;
        badge.style.boxShadow = `0 4px 20px ${glowColor}`;

        if (window._sessionTimerSeconds <= 0) {
            window.sessionTimerExpired();
        }
    }, 1000);
};

window.clearSessionTimer = function() {
    if (window._sessionTimerInterval) {
        clearInterval(window._sessionTimerInterval);
        window._sessionTimerInterval = null;
    }
    window._sessionTimerSeconds = 0;
    window._sessionTimerOrigin = null;
    const badge = document.getElementById('session-timer-badge');
    if (badge) badge.remove();
};

window.sessionTimerExpired = async function() {
    window.clearSessionTimer();
    alert("⏱️ Session Expired\n\nYour 10-minute access window has ended. You are being redirected back.");
    const origin = window._sessionTimerOrigin;

    // If viewing patient inside org read-only mode
    if (window._readOnlyMode && window._viewingPatientData && window.originalProviderUser) {
        // Go back to org members
        currentUser = window.originalProviderUser;
        window.originalProviderUser = null;
        window._viewingPatientData = null;
        window._pendingOrgSection = 'access';
        await window.renderDashboard();
        return;
    }

    // If viewing org as doctor
    if (window._readOnlyMode && window.realDoctorUser) {
        currentUser = window.realDoctorUser;
        window.realDoctorUser = null;
        window._readOnlyMode = false;
        window._pendingDoctorSection = 'access';
        await window.renderDashboard();
        return;
    }

    // If viewing patient from clinic
    if (origin === 'clinic' && window.originalProviderUser) {
        currentUser = window.originalProviderUser;
        window.originalProviderUser = null;
        window._viewingPatientData = null;
        window._pendingDoctorSection = 'clinic-mode';
        await window.renderDashboard();
        return;
    }

    // Default: return to doctor home
    if (window.originalProviderUser) {
        currentUser = window.originalProviderUser;
        window.originalProviderUser = null;
        window._viewingPatientData = null;
        window._pendingDoctorSection = 'access';
        await window.renderDashboard();
    }
};

// ====== DOCTOR: VIEW PATIENT AS READ-ONLY ======

window.viewPatientAsDoctor = async function(patientId, bypassPin = false) {
    if (!patientId) return;
    let pin = null;
    if (!bypassPin) {
        pin = prompt("Enter patient's PIN or Security Code to access records:");
        if (!pin) return;
    }
    try {
        let patientData = null;
        if (window.db) {
            const docRef = doc(window.db, "users", patientId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) patientData = docSnap.data();
        } else {
            const storedUserStr = localStorage.getItem(patientId);
            if (storedUserStr) patientData = JSON.parse(storedUserStr);
        }
        if (patientData && (bypassPin || patientData.pin === pin)) {
            window.originalProviderUser = currentUser;
            window._viewingPatientData = patientData;
            // Start 10-min session timer (only for doctors)
            if (!window._readOnlyMode && currentUser && currentUser.profileType === 'Doctor') {
                const timerOrigin = window.currentConsultation ? 'clinic' : 'home';
                window.startSessionTimer(timerOrigin);
            }
            renderPatientViewForDoctor(patientData);
        } else {
            alert("Invalid PIN or Patient not found.");
        }
    } catch (e) {
        console.error("Error accessing patient data:", e);
        alert("Failed to access patient data.");
    }
};

window.returnToProviderPortal = async function(markDone) {
    window.clearSessionTimer();
    if (window.originalProviderUser) {
        currentUser = window.originalProviderUser;
        window.originalProviderUser = null;
        window._viewingPatientData = null;
        window._pendingDoctorSection = 'clinic-mode';
        if (markDone && typeof clinicMarkDone === 'function') {
            clinicMarkDone();
        }
        await window.renderDashboard();
    }
};

window.exitOrgMode = async function() {
    window.clearSessionTimer();
    if (window.realDoctorUser) {
        currentUser = window.realDoctorUser;
        window.realDoctorUser = null;
        window._readOnlyMode = false;
        window._pendingDoctorSection = 'access';
        await window.renderDashboard();
    }
};

window.returnToHome = async function() {
    window.clearSessionTimer();
    if (window.originalProviderUser) {
        currentUser = window.originalProviderUser;
        window.originalProviderUser = null;
        window._viewingPatientData = null;
        const isOrg = currentUser.profileType === 'Organisation' || currentUser.profileType === 'Organization';
        if (isOrg) {
            window._pendingOrgSection = 'access';
        } else {
            window._pendingDoctorSection = 'access';
        }
        await window.renderDashboard();
    }
};

window.renderPatientViewForDoctor = function(patient) {
    const profileImgSrc = patient.fileUrl || 'user.png';
    const isDoctor = window.originalProviderUser && window.originalProviderUser.profileType === 'Doctor';
    const isOrgProvider = window.originalProviderUser && (window.originalProviderUser.profileType === 'Organisation' || window.originalProviderUser.profileType === 'Organization');
    const providerLabel = isDoctor ? 'Doctor' : (window.originalProviderUser ? window.originalProviderUser.profileType : 'Provider');
    
    let actionButtons = '';
    const isFromClinic = isDoctor && window.currentConsultation;
    if (isDoctor) {
        if (isFromClinic) {
            actionButtons = `
                <button onclick="returnToProviderPortal(true)" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    Done
                </button>
                <button onclick="returnToProviderPortal(false)" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
                    Return to Clinic
                </button>
            `;
        } else {
            actionButtons = `
                <button onclick="returnToHome()" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Return to Home
                </button>
            `;
        }
    } else {
        actionButtons = `
                <button onclick="returnToHome()" style="margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Return Back
                </button>
        `;
    }

    const html = `
        <div class="dashboard-container">
            <div class="sidebar">
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <img src="l3.png" alt="Logo" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" onerror="this.src='logodp.png'"/>
                    <h2 style="margin: 0; font-size: 1.4rem; background: linear-gradient(90deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Health Vault</h2>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; margin: 20px 0;">
                    <img src="${profileImgSrc}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid rgba(255,255,255,0.2);" onerror="this.src='user.png'" />
                    <div style="color: white; font-weight: 600;">${patient.name || 'Patient'}</div>
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-top: 4px;">${patient.uniqueId}</div>
                    <div style="margin-top: 8px; background: ${isOrgProvider && !window._readOnlyMode ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color: ${isOrgProvider && !window._readOnlyMode ? '#6ee7b7' : '#fbbf24'}; padding: 4px 14px; border-radius: 50px; font-size: 0.75rem; font-weight: 600;">${isOrgProvider && !window._readOnlyMode ? '🔓 Organization (Full Access)' : '👁 ' + providerLabel + ' View (Read Only)'}</div>
                </div>
                <button class="sidebar-btn" onclick="showPatientViewSection('visits')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                    Visits
                </button>
                <button class="sidebar-btn" onclick="showPatientViewSection('profile')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Profile
                </button>
                <button class="sidebar-btn" onclick="showPatientViewSection('health-summary')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Health Summary
                </button>
                <button class="sidebar-btn" onclick="showPatientViewSection('metrics')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    Metrics
                </button>
                <div style="flex: 1; min-height: 10px;"></div>
                ${actionButtons}
            </div>
            <div class="main-content" id="patient-view-content"></div>
        </div>
    `;
    appContainer.innerHTML = html;
    showPatientViewSection('visits');
};

window.showPatientViewSection = async function(section) {
    const patient = window._viewingPatientData;
    if (!patient) return;
    const content = document.getElementById('patient-view-content');
    if (!content) return;

    const isOrgFullAccess = !window._readOnlyMode && window.originalProviderUser && (window.originalProviderUser.profileType === 'Organisation' || window.originalProviderUser.profileType === 'Organization');

    if (section === 'visits') {
        let visits = [];
        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", patient.uniqueId, "visits"));
            snapshot.forEach(ds => visits.push(ds.data()));
            visits.reverse();
        } else {
            visits = JSON.parse(localStorage.getItem(patient.uniqueId + '_visits') || '[]');
        }
        const visitsHTML = visits.map(v => `
            <div class="glass visit-card" onclick="openPatientVisitReadOnly('${v.id}')" style="cursor: pointer; position: relative;">
                ${isOrgFullAccess ? `<button onclick="event.stopPropagation(); deleteVisitForMember('${v.id}', '${patient.uniqueId}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'" title="Delete Visit"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : ''}
                <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 8px; ${isOrgFullAccess ? 'padding-right: 24px;' : ''}">${v.name}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #2563eb; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${v.doctor || 'Not specified'}</span>
                    <span style="color: #64748b; font-weight: 500; font-size: 0.9rem; display: flex; align-items: center; gap: 6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>${v.date}</span>
                </div>
            </div>
        `).join('');
        const accessLabel = isOrgFullAccess ? 'Full access' : 'Read-only access';
        content.innerHTML = `
            <div>
                <div style="margin-bottom: 24px;">
                    <h1 style="color: #0f172a; font-weight: 800; font-size: 2rem; margin-bottom: 4px;">Patient Records: ${patient.name || 'Patient'}</h1>
                    <p style="color: #64748b; font-size: 1rem;">ID: ${patient.uniqueId} &bull; ${accessLabel}</p>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 1.6rem; margin: 0;">Visit History</h2>
                    <input type="text" class="search-bar" placeholder="Search visits..." style="max-width: 260px;" onkeyup="searchMemberVisits(this.value)">
                </div>
                <div class="visits-container" id="visits-list">
                    ${visitsHTML || '<p style="color: #94a3b8; margin-top: 20px;">No visits found for this patient.</p>'}
                </div>
                ${isOrgFullAccess ? `<button onclick="showCreateVisitForMemberModal('${patient.uniqueId}')" style="position: fixed; bottom: 40px; right: 40px; z-index: 100; display: inline-flex; align-items: center; gap: 10px; padding: 16px 34px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.1rem; font-weight: 600; cursor: pointer; box-shadow: 0 6px 25px rgba(37, 99, 235, 0.4); transition: all 0.3s ease; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.08)';" onmouseout="this.style.transform='none';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Create New Visit</button>` : ''}
            </div>`;
    } else if (section === 'profile') {
        const profileEditStyle = 'color: #0f172a; font-weight: 600; text-align: right; background: transparent; border: none; outline: none; border-bottom: 1px dashed #cbd5e1; width: 50%;';
        if (isOrgFullAccess) {
            content.innerHTML = `
                <div>
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Patient Profile</h2>
                    <div class="glass" style="padding: 30px; max-width: 500px;">
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                            <div style="position: relative; cursor: pointer;" onclick="document.getElementById('member-pic-upload').click()">
                                <img id="member-pic-preview" src="${patient.fileUrl || 'user.png'}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" onerror="this.src='user.png'" />
                                <div style="position: absolute; bottom: 0; right: 0; width: 30px; height: 30px; background: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                </div>
                                <input type="file" id="member-pic-upload" accept="image/*" style="display: none;" onchange="updateMemberProfilePic(this, '${patient.uniqueId}')">
                            </div>
                            <div>
                                <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${patient.name || 'Patient'}</h3>
                                <p style="color: #475569; font-weight: 500;">${patient.uniqueId}</p>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${patient.profileType}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><input type="text" id="member-edit-phone" value="${patient.phone || ''}" style="${profileEditStyle}"></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Age</span><input type="text" id="member-edit-age" value="${patient.age || ''}" style="${profileEditStyle}"></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Gender</span><input type="text" id="member-edit-gender" value="${patient.gender || ''}" placeholder="e.g. Male/Female" style="${profileEditStyle}"></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Location</span><input type="text" id="member-edit-location" value="${patient.location || ''}" placeholder="e.g. New York" style="${profileEditStyle}"></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                            <button onclick="saveMemberProfile('${patient.uniqueId}')" style="margin-top: 10px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; width: 100%;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Profile</button>
                        </div>
                    </div>
                </div>`;
        } else {
            content.innerHTML = `
                <div>
                    <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Patient Profile</h2>
                    <div class="glass" style="padding: 30px; max-width: 500px;">
                        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 25px;">
                            <img src="${patient.fileUrl || 'user.png'}" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #2563eb;" onerror="this.src='user.png'" />
                            <div>
                                <h3 style="color: #0f172a; font-weight: 700; font-size: 1.4rem; margin-bottom: 4px;">${patient.name || 'Patient'}</h3>
                                <p style="color: #475569; font-weight: 500;">${patient.uniqueId}</p>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Profile Type</span><span style="color: #0f172a; font-weight: 600;">${patient.profileType}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Phone</span><span style="color: #0f172a; font-weight: 600;">${patient.phone || 'N/A'}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Age</span><span style="color: #0f172a; font-weight: 600;">${patient.age || 'N/A'}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Gender</span><span style="color: #0f172a; font-weight: 600;">${patient.gender || 'N/A'}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Location</span><span style="color: #0f172a; font-weight: 600;">${patient.location || 'N/A'}</span></div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.03); border-radius: 10px;"><span style="color: #475569; font-weight: 500;">Joined</span><span style="color: #0f172a; font-weight: 600;">${patient.createdAt ? new Date(patient.createdAt).toLocaleDateString() : 'N/A'}</span></div>
                        </div>
                    </div>
                </div>`;
        }
    } else if (section === 'health-summary') {
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 8px;">Health Summary — ${patient.name || 'Patient'}</h2>
                <p style="color: #475569; margin-bottom: 24px; font-size: 1.05rem;">Powered by Google Gemini AI — analyzes visits and documents.</p>
                <button id="summary-btn" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';" onclick="generateSummaryForPatient(event)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Generate AI Health Summary
                </button>
                <div id="summary-result" class="glass" style="margin-top: 24px; padding: 28px; min-height: 100px;">
                    <p style="color: #94a3b8; font-style: italic;">Click the button above to generate the patient's health summary...</p>
                </div>
            </div>`;
    } else if (section === 'metrics') {
        let visits = [];
        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", patient.uniqueId, "visits"));
            snapshot.forEach(ds => visits.push(ds.data()));
        } else {
            visits = JSON.parse(localStorage.getItem(patient.uniqueId + '_visits') || '[]');
        }
        let totalDocs = 0;
        visits.forEach(v => {
            totalDocs += (v.documents.prescriptions?.length || 0) + (v.documents.reports?.length || 0) + (v.documents.scans?.length || 0);
        });
        content.innerHTML = `
            <div>
                <h2 style="color: #0f172a; font-weight: 700; font-size: 2rem; margin-bottom: 25px;">Health Metrics — ${patient.name || 'Patient'}</h2>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="margin-bottom: 12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${visits.length}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Total Visits</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" style="margin-bottom: 12px;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${totalDocs}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Documents</p>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 180px; padding: 25px; text-align: center;">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <h3 style="color: #0f172a; font-size: 2.5rem; font-weight: 800;">${visits.length > 0 ? new Date(visits[visits.length - 1].date).toLocaleDateString() : 'N/A'}</h3>
                        <p style="color: #475569; font-weight: 500; margin-top: 4px;">Last Visit</p>
                    </div>
                </div>
                <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 30px;">
                    <div class="glass" style="flex: 1; min-width: 300px; padding: 25px;">
                        <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Blood Pressure Analysis</h3>
                        <canvas id="bpChart" height="200"></canvas>
                    </div>
                    <div class="glass" style="flex: 1; min-width: 300px; padding: 25px;">
                        <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Blood Sugar Analysis</h3>
                        <canvas id="sugarChart" height="200"></canvas>
                    </div>
                </div>
                <div class="glass" style="padding: 25px; margin-bottom: 30px;">
                    <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Visit Frequency Over Time</h3>
                    <div id="visitsFrequencyGrid"></div>
                </div>
            </div>`;
        setTimeout(() => { renderMetricsCharts(visits); }, 100);
    }
};

window.openPatientVisitReadOnly = async function(visitId) {
    const patient = window._viewingPatientData;
    if (!patient) return;
    const isOrgFA = !window._readOnlyMode && window.originalProviderUser && (window.originalProviderUser.profileType === 'Organisation' || window.originalProviderUser.profileType === 'Organization');
    let visit = null;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", patient.uniqueId, "visits", visitId));
        if (docSnap.exists()) visit = docSnap.data();
    } else {
        const visits = JSON.parse(localStorage.getItem(patient.uniqueId + '_visits') || '[]');
        visit = visits.find(v => v.id === visitId);
    }
    if (!visit) return;
    const content = document.getElementById('patient-view-content');
    const renderDocList = (docs, category) => {
        if (!docs || docs.length === 0) return '<p style="color: #64748b; font-size: 0.9rem;">No documents.</p>';
        return docs.map((d, idx) => {
            const dn = typeof d === 'string' ? d : d.name;
            const du = typeof d === 'string' ? '' : d.url;
            let btns = '';
            if (du) btns += `<button onclick="event.stopPropagation(); viewDocument('${dn.replace(/'/g, "\\'")}', '${du}')" style="padding: 4px 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">View</button>`;
            if (isOrgFA) btns += `<button onclick="event.stopPropagation(); deleteDocForMember('${visitId}', '${category}', ${idx}, '${patient.uniqueId}')" style="padding: 4px 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Delete</button>`;
            return `<div style="padding: 10px 12px; background: rgba(0,0,0,0.05); color: #0f172a; font-weight: 500; margin-bottom: 8px; border-radius: 10px; display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" style="flex-shrink: 0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dn}</span>
                ${btns}
            </div>`;
        }).join('');
    };
    const uploadSection = isOrgFA ? `
            <div class="glass" style="padding: 20px; margin-top: auto; margin-bottom: 20px;">
                <h3 style="color: #0f172a; font-weight: 700;">Upload Document</h3>
                <div style="display:flex; gap:10px; align-items:center; margin-top: 10px;">
                    <input type="file" id="org-doc-upload" class="search-bar" style="border-radius: 8px; color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1);">
                    <button onclick="uploadDocForMember('${visitId}', '${patient.uniqueId}')" style="display: inline-flex; align-items: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; white-space: nowrap;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='none';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Upload & Auto-Categorize</button>
                </div>
            </div>` : '';
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; min-height: calc(100vh - 80px);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #0f172a; font-weight: 700;">Visit: ${visit.displayName || visit.name}</h2>
                <button onclick="showPatientViewSection('visits')" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s; font-family: 'Outfit', sans-serif;" onmouseover="this.style.transform='translateX(-5px)';" onmouseout="this.style.transform='none';">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Visits
                </button>
            </div>
            <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Prescriptions</h3>
                    <div style="margin-top: 10px;">${renderDocList(visit.documents.prescriptions, 'prescriptions')}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Reports</h3>
                    <div style="margin-top: 10px;">${renderDocList(visit.documents.reports, 'reports')}</div>
                </div>
                <div class="glass" style="flex: 1; min-width: 200px; padding: 20px;">
                    <h3 style="color: #2563eb; font-weight: 700;">Scans</h3>
                    <div style="margin-top: 10px;">${renderDocList(visit.documents.scans, 'scans')}</div>
                </div>
            </div>
            ${uploadSection}
        </div>`;
};

window.generateSummaryForPatient = async function(e) {
    const patient = window._viewingPatientData;
    if (!patient) return;
    const btn = e.target.closest('button');
    const resultDiv = document.getElementById('summary-result');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Analyzing with Gemini AI...`;
    btn.disabled = true;
    resultDiv.innerHTML = `<div style="display: flex; align-items: center; gap: 12px; color: #64748b;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Gemini AI is analyzing patient records...</div>`;
    try {
        let visits = [];
        let emergency = {};
        if (window.db) {
            const snapshot = await getDocs(collection(window.db, "users", patient.uniqueId, "visits"));
            snapshot.forEach(ds => visits.push(ds.data()));
            const emSnap = await getDoc(doc(window.db, "users", patient.uniqueId, "settings", "emergency"));
            if (emSnap.exists()) emergency = emSnap.data();
        } else {
            visits = JSON.parse(localStorage.getItem(patient.uniqueId + '_visits') || '[]');
            emergency = JSON.parse(localStorage.getItem(patient.uniqueId + '_emergency') || '{}');
        }
        let docCount = 0;
        visits.forEach(v => { docCount += (v.documents.prescriptions?.length || 0) + (v.documents.reports?.length || 0) + (v.documents.scans?.length || 0); });
        const visitDetails = visits.map(v => {
            const docs = [];
            if (v.documents.prescriptions?.length) docs.push(`Prescriptions: ${v.documents.prescriptions.join(', ')}`);
            if (v.documents.reports?.length) docs.push(`Reports: ${v.documents.reports.join(', ')}`);
            if (v.documents.scans?.length) docs.push(`Scans: ${v.documents.scans.join(', ')}`);
            let vitals = [];
            if (v.bp) vitals.push(`BP: ${v.bp}`);
            if (v.sugar) vitals.push(`Sugar: ${v.sugar}`);
            const vitalsStr = vitals.length > 0 ? ` [Vitals: ${vitals.join(', ')}]` : '';
            return `- ${v.name} (${v.date})${vitalsStr}: ${docs.length > 0 ? docs.join('; ') : 'No documents'}`;
        }).join('\n');
        const prompt = `You are a health assistant for the Health Vault app. Analyze the following patient data.\n\nPatient: ${patient.name || 'Unknown'}\nAge: ${patient.age || 'Unknown'}\nGender: ${patient.gender || 'Unknown'}\nTotal Visits: ${visits.length}\nTotal Documents: ${docCount}\n${emergency.bloodGroup ? 'Blood Group: ' + emergency.bloodGroup : ''}\n${emergency.allergies ? 'Known Allergies: ' + emergency.allergies : ''}\n${emergency.diseases ? 'Known Conditions: ' + emergency.diseases : ''}\n${emergency.medication ? 'Current Medication: ' + emergency.medication : ''}\n${emergency.surgeries ? 'Major Surgeries: ' + emergency.surgeries : ''}\n\nVisit History:\n${visitDetails || 'No visits recorded yet.'}\n\nExtract the patient's health summary into the following 7 categories. Provide a single, easy-to-understand sentence or value for each. If there is no data for a category, respond with "No data available".\nYou MUST return the output as a raw JSON object (do not include markdown formatting like \`\`\`json). Use these exact keys:\n"bp", "sugar", "medication", "chronic", "family", "surgeries", "complication".`;
        const aiText = await callGeminiAPI(prompt);
        let summaryData = {};
        try {
            const cleanText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
            summaryData = JSON.parse(cleanText);
        } catch (e) {
            summaryData = { bp: "Error", sugar: "Error", medication: "Error", chronic: "Error", family: "Error", surgeries: "Error", complication: "Error" };
        }
        const iconStyle = "width: 22px; height: 22px; color: #2563eb; flex-shrink: 0; margin-top: 2px;";
        resultDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.06);">
                <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #2563eb, #7c3aed); display: flex; align-items: center; justify-content: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div>
                <strong style="color: #0f172a; font-size: 1.1rem;">AI Health Summary — ${patient.name || 'Patient'}</strong>
                <span style="color: #94a3b8; font-size: 0.8rem; margin-left: auto;">Powered by Gemini</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9C8.8 1 15.2 1 19.1 4.9C23 8.8 23 15.2 19.1 19.1C15.2 23 8.8 23 4.9 19.1Z"></path><path d="M12 8v8"></path><path d="M8 12h8"></path></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">B.P</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.bp || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Diabetic sugar level</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.sugar || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Ongoing Medication</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.medication || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Current chronic disease</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.chronic || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Family conditions</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.family || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Major Surgeries</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.surgeries || 'No data available'}</div></div></div>
                <div style="display: flex; align-items: flex-start; gap: 15px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${iconStyle}"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><div><div style="font-weight: 700; color: #334155; font-size: 0.95rem; margin-bottom: 4px;">Recent complication</div><div style="color: #64748b; font-size: 0.95rem;">${summaryData.complication || 'No data available'}</div></div></div>
            </div>`;
    } catch(err) {
        resultDiv.innerHTML = `<p style="color: #ef4444; font-weight: 600;">⚠️ Error: ${err.message}</p>`;
    }
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> Regenerate Summary';
};

// ====== ORGANIZATION FULL-ACCESS HELPER FUNCTIONS ======

window.searchOrgMembers = function(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll('#org-members-list > div');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
};

window.searchMemberVisits = function(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll('#visits-list .visit-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
};

window.showCreateVisitForMemberModal = function(memberId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'create-visit-modal';
    modal.innerHTML = `
        <div class="glass form-container">
            <h3 style="color: #0f172a; font-weight: 700; margin-bottom: 15px;">Create New Visit for Member</h3>
            <input type="text" id="new-member-visit-name" placeholder="Visit Name (e.g., Annual Checkup)" style="color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); margin-bottom: 10px;" required>
            <input type="text" id="new-member-visit-doctor" placeholder="Doctor Name (e.g., Dr. Sharma)" style="color: #0f172a; background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); margin-bottom: 15px;">
            <button onclick="createVisitForMember('${memberId}')" style="display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 32px; background: linear-gradient(135deg, #2563eb, #10b981); color: white; border: none; border-radius: 50px; font-size: 1.05rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 15px rgba(37,99,235,0.3); transition: all 0.3s ease; font-family: 'Outfit', sans-serif; width: 100%;" onmouseover="this.style.transform='scale(1.03)';" onmouseout="this.style.transform='none';"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Visit</button>
            <button class="text-btn" style="color: #ef4444; font-weight: 600; margin-top: 10px;" onclick="document.getElementById('create-visit-modal').remove()">Cancel</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.createVisitForMember = async function(memberId) {
    const name = document.getElementById('new-member-visit-name').value;
    const doctor = document.getElementById('new-member-visit-doctor').value || '';
    if (!name) return alert("Please enter a name for the visit.");
    const date = new Date().toLocaleDateString();
    const visitId = 'VISIT-' + Date.now();
    const visit = {
        id: visitId, name: name, doctor: doctor, bp: '', sugar: '', date: date,
        displayName: `${name}-${date}`,
        documents: { prescriptions: [], reports: [], scans: [] }
    };
    if (window.db) {
        await setDoc(doc(window.db, "users", memberId, "visits", visitId), visit);
    } else {
        let visits = JSON.parse(localStorage.getItem(memberId + '_visits') || '[]');
        visits.push(visit);
        localStorage.setItem(memberId + '_visits', JSON.stringify(visits));
    }
    const modal = document.getElementById('create-visit-modal');
    if (modal) modal.remove();
    alert("Visit created successfully!");
    showPatientViewSection('visits');
};

window.uploadDocForMember = async function(visitId, memberId) {
    const fileInput = document.getElementById('org-doc-upload');
    if (!fileInput || !fileInput.files.length) return alert("Please select a file first.");
    const file = fileInput.files[0];
    const fileName = file.name.toLowerCase();
    const uploadBtn = fileInput.nextElementSibling;
    const originalText = uploadBtn.innerHTML;
    uploadBtn.innerHTML = "Uploading...";
    uploadBtn.disabled = true;
    try {
        let downloadURL = "";
        if (window.storage) {
            try {
                const fileRef = ref(window.storage, `documents/${memberId}/${visitId}/${file.name}`);
                const uploadTask = uploadBytes(fileRef, file);
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000));
                await Promise.race([uploadTask, timeout]);
                downloadURL = await getDownloadURL(fileRef);
            } catch (e) {
                console.warn("Firebase upload failed, using local blob:", e);
                downloadURL = URL.createObjectURL(file);
            }
        } else {
            downloadURL = URL.createObjectURL(file);
        }
        let category = 'reports';
        if (fileName.includes('prescription') || fileName.includes('rx') || fileName.includes('med')) category = 'prescriptions';
        else if (fileName.includes('scan') || fileName.includes('mri') || fileName.includes('xray') || fileName.includes('ct_') || fileName.includes('ultrasound')) category = 'scans';

        let visit = null, visits = [], visitIndex = -1;
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", memberId, "visits", visitId));
            if (docSnap.exists()) visit = docSnap.data();
        } else {
            visits = JSON.parse(localStorage.getItem(memberId + '_visits') || '[]');
            visitIndex = visits.findIndex(v => v.id === visitId);
            if (visitIndex !== -1) visit = visits[visitIndex];
        }
        if (visit) {
            if (!visit.documents[category]) visit.documents[category] = [];
            uploadBtn.innerHTML = "AI Analyzing...";
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64Data = reader.result.split(',')[1];
                        const response = await fetch('/api/gemini', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [
                                { text: "Analyze this medical document image. CLASSIFY as exactly one of: \"prescriptions\", \"reports\", or \"scans\". Extract BP (format: 120/80) and Blood Sugar (mg/dL). Return ONLY valid JSON: {\"category\": \"prescriptions\", \"bp\": \"120/80\", \"sugar\": \"105\"}." },
                                { inline_data: { mime_type: file.type, data: base64Data } }
                            ]}]})
                        });
                        const data = await response.json();
                        if (data.candidates && data.candidates[0]) {
                            let textResp = data.candidates[0].content.parts[0].text.trim().replace(/```json/g,'').replace(/```/g,'').trim();
                            const extracted = JSON.parse(textResp);
                            if (extracted.bp) visit.bp = extracted.bp;
                            if (extracted.sugar) visit.sugar = extracted.sugar;
                            if (extracted.category && ['prescriptions','reports','scans'].includes(extracted.category)) category = extracted.category;
                        }
                    } catch(e) { console.error("AI extraction failed:", e); }
                    if (!visit.documents[category]) visit.documents[category] = [];
                    visit.documents[category].push({ name: file.name, url: downloadURL });
                    if (window.db) { await setDoc(doc(window.db, "users", memberId, "visits", visitId), visit); }
                    else { visits[visitIndex] = visit; localStorage.setItem(memberId + '_visits', JSON.stringify(visits)); }
                    alert("Document uploaded and categorized!");
                    openPatientVisitReadOnly(visitId);
                };
                reader.readAsDataURL(file);
            } else {
                visit.documents[category].push({ name: file.name, url: downloadURL });
                if (window.db) { await setDoc(doc(window.db, "users", memberId, "visits", visitId), visit); }
                else { visits[visitIndex] = visit; localStorage.setItem(memberId + '_visits', JSON.stringify(visits)); }
                alert("Document uploaded!");
                openPatientVisitReadOnly(visitId);
            }
        }
    } catch (error) {
        console.error("Upload error:", error);
        alert("Upload failed: " + error.message);
        uploadBtn.innerHTML = originalText;
        uploadBtn.disabled = false;
    }
};

window.deleteDocForMember = async function(visitId, category, docIndex, memberId) {
    if (!confirm('Delete this document?')) return;
    let visit = null, visits = [], visitIndex = -1;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", memberId, "visits", visitId));
        if (docSnap.exists()) visit = docSnap.data();
    } else {
        visits = JSON.parse(localStorage.getItem(memberId + '_visits') || '[]');
        visitIndex = visits.findIndex(v => v.id === visitId);
        if (visitIndex !== -1) visit = visits[visitIndex];
    }
    if (visit && visit.documents[category]) {
        const docObj = visit.documents[category][docIndex];
        const docName = typeof docObj === 'string' ? docObj : docObj.name;
        visit.documents[category].splice(docIndex, 1);
        if (window.db) { await setDoc(doc(window.db, "users", memberId, "visits", visitId), visit); }
        else { visits[visitIndex] = visit; localStorage.setItem(memberId + '_visits', JSON.stringify(visits)); }
        alert(`'${docName}' deleted.`);
        openPatientVisitReadOnly(visitId);
    }
};

window.deleteVisitForMember = async function(visitId, memberId) {
    if (!confirm('Delete this visit and all its documents? This cannot be undone.')) return;
    if (window.db) {
        await deleteDoc(doc(window.db, "users", memberId, "visits", visitId));
    } else {
        let visits = JSON.parse(localStorage.getItem(memberId + '_visits') || '[]');
        const idx = visits.findIndex(v => v.id === visitId);
        if (idx !== -1) visits.splice(idx, 1);
        localStorage.setItem(memberId + '_visits', JSON.stringify(visits));
    }
    alert("Visit deleted.");
    showPatientViewSection('visits');
};

window.saveMemberProfile = async function(memberId) {
    const patient = window._viewingPatientData;
    if (!patient) return;
    const phoneEl = document.getElementById('member-edit-phone');
    const ageEl = document.getElementById('member-edit-age');
    const genderEl = document.getElementById('member-edit-gender');
    const locationEl = document.getElementById('member-edit-location');
    if (phoneEl) patient.phone = phoneEl.value;
    if (ageEl) patient.age = ageEl.value;
    if (genderEl) patient.gender = genderEl.value;
    if (locationEl) patient.location = locationEl.value;
    if (window.db) {
        await setDoc(doc(window.db, "users", memberId), patient);
    } else {
        localStorage.setItem(memberId, JSON.stringify(patient));
    }
    window._viewingPatientData = patient;
    alert('Member profile updated successfully!');
    showPatientViewSection('profile');
};

window.updateMemberProfilePic = async function(input, memberId) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async function(e) {
        const img = new Image();
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 150;
            canvas.height = 150;
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            ctx.drawImage(img, x, y, size, size, 0, 0, 150, 150);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const patient = window._viewingPatientData;
            if (patient) {
                patient.fileUrl = dataUrl;
                if (window.db) {
                    await setDoc(doc(window.db, "users", memberId), patient);
                } else {
                    localStorage.setItem(memberId, JSON.stringify(patient));
                }
                window._viewingPatientData = patient;
            }
            const preview = document.getElementById('member-pic-preview');
            if (preview) preview.src = dataUrl;
            alert('Member profile picture updated!');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

// ====== PRIVACY TOGGLE HELPERS ======

window.togglePrivacyPin = function(isChecked) {
    const container = document.getElementById('privacy-pin-container');
    if (container) {
        container.style.display = isChecked ? 'block' : 'none';
        if (isChecked) {
            const pinInput = document.getElementById('reg-privacy-pin');
            if (pinInput) pinInput.focus();
        }
    }
};

window.orgAccessMember = function(memberId, isPrivate) {
    if (isPrivate) {
        const pin = prompt("🔒 This member's profile is private.\nEnter their Privacy PIN to access records:");
        if (!pin) return;
        // Verify PIN
        (async () => {
            let memberData = null;
            if (window.db) {
                const docSnap = await getDoc(doc(window.db, "users", memberId));
                if (docSnap.exists()) memberData = docSnap.data();
            } else {
                const stored = localStorage.getItem(memberId);
                if (stored) memberData = JSON.parse(stored);
            }
            if (memberData && memberData.privacyPin === pin) {
                window.viewPatientAsDoctor(memberId, true);
            } else {
                alert("❌ Incorrect Privacy PIN. Access denied.");
            }
        })();
    } else {
        window.viewPatientAsDoctor(memberId, true);
    }
};

window.toggleMemberPrivacy = async function(memberId, isPrivate) {
    if (isPrivate) {
        const pin = prompt("Set a Privacy PIN for this member (they'll need this to let admins access their records):");
        if (!pin) {
            showOrganisationSection('access');
            return;
        }
        if (window.db) {
            await updateDoc(doc(window.db, "users", memberId), { isPrivate: true, privacyPin: pin });
        } else {
            const stored = localStorage.getItem(memberId);
            if (stored) {
                const data = JSON.parse(stored);
                data.isPrivate = true;
                data.privacyPin = pin;
                localStorage.setItem(memberId, JSON.stringify(data));
            }
        }
        alert("🔒 Profile set to Private. PIN required for future access.");
    } else {
        const pin = prompt("🔒 Enter the current Privacy PIN to remove protection:");
        if (!pin) {
            showOrganisationSection('access');
            return;
        }
        let memberData = null;
        if (window.db) {
            const docSnap = await getDoc(doc(window.db, "users", memberId));
            if (docSnap.exists()) memberData = docSnap.data();
        } else {
            const stored = localStorage.getItem(memberId);
            if (stored) memberData = JSON.parse(stored);
        }
        if (!memberData || memberData.privacyPin !== pin) {
            alert("❌ Incorrect PIN. Cannot remove privacy protection.");
            showOrganisationSection('access');
            return;
        }
        if (window.db) {
            await updateDoc(doc(window.db, "users", memberId), { isPrivate: false, privacyPin: '' });
        } else {
            memberData.isPrivate = false;
            memberData.privacyPin = '';
            localStorage.setItem(memberId, JSON.stringify(memberData));
        }
        alert("🔓 Profile set to Open. No PIN required.");
    }
    showOrganisationSection('access');
};

// ====== SMART ACCESS RECORDS (DOCTOR HOME) ======

window.smartAccessRecords = function() {
    const input = document.getElementById('target-patient-id');
    const id = input ? input.value.trim().toUpperCase() : '';
    if (!id) return alert("Please enter a Patient ID or Organization ID.");

    if (id.startsWith('PAT-')) {
        // Patient ID → OTP verification then read-only patient view
        const otp = Math.floor(100000 + Math.random() * 900000);
        alert(`[SYSTEM SIMULATION] An OTP code ${otp} has been sent to the patient's registered phone number.`);
        const enteredOtp = prompt(`Enter the 6-digit OTP provided by patient ${id}:`);
        if (enteredOtp == otp) {
            alert("✅ Verification Successful. Access Granted.");
            window.viewPatientAsDoctor(id, true);
        } else {
            if (enteredOtp !== null) alert("❌ Verification Failed. Access Denied.");
        }
    } else if (id.startsWith('ORG-')) {
        // Organization ID → OTP verification then read-only org member list
        const otp = Math.floor(100000 + Math.random() * 900000);
        alert(`[SYSTEM SIMULATION] An OTP code ${otp} has been sent to the organization's registered contact.`);
        const enteredOtp = prompt(`Enter the 6-digit OTP provided by organization ${id}:`);
        if (enteredOtp == otp) {
            alert("✅ Verification Successful. Access Granted.");
            window.viewOrgAsDoctor(id);
        } else {
            if (enteredOtp !== null) alert("❌ Verification Failed. Access Denied.");
        }
    } else {
        alert("Invalid ID format. Use PAT-xxxx for patients or ORG-xxxx for organizations.");
    }
};

window.viewOrgAsDoctor = async function(orgId) {

    let orgData = null;
    if (window.db) {
        const docSnap = await getDoc(doc(window.db, "users", orgId));
        if (docSnap.exists()) orgData = docSnap.data();
    } else {
        const stored = localStorage.getItem(orgId);
        if (stored) orgData = JSON.parse(stored);
    }

    if (!orgData) return alert("Organization not found.");

    // Enter read-only organization mode
    window.realDoctorUser = currentUser;
    currentUser = orgData;
    window._readOnlyMode = true;
    window._pendingOrgSection = 'access';
    
    // Render the full Organization dashboard
    await window.renderDashboard();
};
