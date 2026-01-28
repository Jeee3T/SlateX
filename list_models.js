require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        // Correct way to list models in latest version
        const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).listModels();
        // Wait, listModels might be a method on the genAI object directly in some versions
        // Let's try to find it on the client
        console.log("Checking for listModels method...");
    } catch (err) {
        console.error("Error listing models:", err.message);
    }
}

// Alternative: Try to see if it's on the client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
console.log("Methods on genAI:", Object.keys(genAI));

async function run() {
    try {
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).generateContent("Hi");
        console.log("Gemini 1.5 Flash is working.");
    } catch (e) {
        console.log("Gemini 1.5 Flash check failed:", e.message);
    }
}
run();
