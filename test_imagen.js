require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateImage() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    // Use the model we found in the list that supports generateContent and has "image-generation" in name
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp-image-generation" });

    try {
        console.log("Generating image with gemini-2.0-flash-exp-image-generation...");
        const result = await model.generateContent("a blue cat");
        const response = await result.response;

        if (response.candidates && response.candidates.length > 0) {
            console.log("Candidates found:", response.candidates.length);
            const content = response.candidates[0].content;

            content.parts.forEach((p, i) => {
                if (p.inlineData) {
                    console.log(`Part ${i} has inlineData! MimeType: ${p.inlineData.mimeType}`);
                } else if (p.text) {
                    console.log(`Part ${i} is text: ${p.text.substring(0, 50)}...`);
                } else {
                    console.log(`Part ${i} keys:`, Object.keys(p));
                }
            });
        } else {
            console.log("No candidates in response.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

generateImage();
