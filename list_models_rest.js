require('dotenv').config();
const https = require('https');
const fs = require('fs');

const apiKey = process.env.GOOGLE_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.models) {
                const names = json.models.map(m => `${m.name} (${m.supportedGenerationMethods.join(", ")})`).join("\n");
                fs.writeFileSync('models.txt', names);
                console.log("Wrote model names to models.txt");
            } else {
                console.log("No models found.");
            }
        } catch (e) {
            console.error("Parse error.");
        }
    });
}).on('error', (err) => {
    console.error("Request error.");
});
