// SmartPark Centralized API Integration Configuration
const API_BASE_URL = "http://localhost:5000/api";

// Helper function to get authorization headers
function getAuthHeaders() {
    const token = localStorage.getItem("smartpark_token");
    return {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };
}

// Global API Request Helper with Fallback support
async function apiRequest(endpoint, method = "GET", data = null) {
    try {
        const options = {
            method,
            headers: getAuthHeaders()
        };

        if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "API request failed");
        }

        return { success: true, data: result };
    } catch (error) {
        console.warn(`[SmartPark API] Server offline or fallback mode for ${endpoint}:`, error.message);
        return { success: false, error: error.message };
    }
}

// Centralized Wallet State Management
function getWalletBalance() {
    const bal = localStorage.getItem("smartpark_wallet_balance");
    if (bal === null || isNaN(parseFloat(bal))) {
        localStorage.setItem("smartpark_wallet_balance", "850");
        return 850;
    }
    return parseFloat(bal);
}

function updateWalletBalance(amountChange, description = "") {
    let current = getWalletBalance();
    let newBal = current + amountChange;
    if (newBal < 0) newBal = 0;
    localStorage.setItem("smartpark_wallet_balance", newBal.toString());

    // Record transaction history in localStorage
    try {
        let txns = JSON.parse(localStorage.getItem("smartpark_wallet_txns") || "[]");
        const type = amountChange >= 0 ? "credit" : "debit";
        const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const absAmt = Math.abs(amountChange);
        
        txns.unshift({
            type,
            amount: absAmt,
            description: description || (type === "credit" ? `Added ₹${absAmt}` : `Payment of ₹${absAmt}`),
            date: formattedDate,
            category: type === "credit" ? "added" : "payment"
        });
        localStorage.setItem("smartpark_wallet_txns", JSON.stringify(txns));
    } catch(e){}

    // Async sync with Backend API
    apiRequest('/wallet/add-funds', 'POST', { amount: amountChange });

    // Instantly refresh UI elements on current page
    refreshWalletUI();
    return newBal;
}

function refreshWalletUI() {
    const bal = getWalletBalance();
    const balFormatted = `₹${Math.round(bal).toLocaleString('en-IN')}`;
    const balDecimal = `₹${bal.toFixed(2)}`;

    // Update wallet badges & text across pages
    document.querySelectorAll('.pay-badge').forEach(el => el.textContent = `${balFormatted} Balance`);
    document.querySelectorAll('.balance-amount').forEach(el => el.textContent = balDecimal);
    document.querySelectorAll('.wallet-bal-text').forEach(el => el.textContent = balFormatted);

    // Update Dashboard Welcome Stat Balance (3rd wstat-num)
    const wStats = document.querySelectorAll('.wstat-num');
    if (wStats && wStats.length >= 3) {
        wStats[2].textContent = balFormatted;
    }
}

// Auto-run UI sync on DOM load
if (typeof window !== 'undefined') {
    window.getWalletBalance = getWalletBalance;
    window.updateWalletBalance = updateWalletBalance;
    window.refreshWalletUI = refreshWalletUI;
    document.addEventListener('DOMContentLoaded', refreshWalletUI);
}

// User Session Management
function getCurrentUser() {
    const userStr = localStorage.getItem("smartpark_user");
    if (!userStr) {
        return {
            name: "Rahul Sharma",
            email: "rahul.sharma@example.com",
            phone: "+91 98765 43210",
            role: "user"
        };
    }
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return { name: "Rahul Sharma", email: "rahul.sharma@example.com" };
    }
}

function logoutUser() {
    localStorage.removeItem("smartpark_token");
    localStorage.removeItem("smartpark_user");
    window.location.href = "login.html";
}
