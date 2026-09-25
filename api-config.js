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
