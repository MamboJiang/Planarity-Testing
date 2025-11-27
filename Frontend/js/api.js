import { mockResponse } from './mock.js';

const BASE_URL = "http://127.0.0.1:5001";

export async function pingServer() {
    try {
        const resp = await fetch(`${BASE_URL}/check-planarity`, { method: "GET", mode: "cors" });
        return resp.ok || resp.status === 404 || resp.status === 405;
    } catch (e) {
        return false;
    }
}

export async function checkPlanarity(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        let data;
        try {
            const response = await fetch(`${BASE_URL}/check-planarity`, {
                method: "POST",
                body: formData
            });
            if (!response.ok) throw new Error("Backend error");
            data = await response.json();
            return { success: true, data: data, serverConnected: true };
        } catch (err) {
            console.warn("Backend connection failed, using mock data.", err);
            data = mockResponse(file.name);
            return { success: true, data: data, serverConnected: false };
        }
    } catch (error) {
        return { success: false, error: error };
    }
}
