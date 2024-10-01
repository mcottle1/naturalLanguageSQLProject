const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const fdir = __dirname;

function getPath(fname) {
    return path.join(fdir, fname);
}

const sqliteDbPath = getPath("database.sqlite");
const setupSqlPath = getPath("setup.sql");
const setupSqlDataPath = getPath("setupData.sql");
const configPath = getPath("config.json");

function loadSqlFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function initDatabase() {
    if (fs.existsSync(sqliteDbPath)) {
        fs.unlinkSync(sqliteDbPath);
    }

    const db = new sqlite3.Database(sqliteDbPath);

    const setupSqlScript = loadSqlFile(setupSqlPath);
    const setupSqlDataScript = loadSqlFile(setupSqlDataPath);

    db.exec(setupSqlScript, (err) => {
        if (err) throw err;
        db.exec(setupSqlDataScript, (err) => {
            if (err) throw err;
        });
    });

    return db;
}

function runSql(query, db) {
    return new Promise((resolve, reject) => {
        db.all(query, (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

function loadConfig() {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

async function getChatGptResponse(prompt, model = "gpt-4", max_tokens = 150, temperature = 0.7, apiKey, organizationId) {
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: max_tokens,
            temperature: temperature
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Organization': organizationId
            }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

function sanitizeSqlResponse(response) {
    const gptStartSqlMarker = "```sql";
    const gptEndSqlMarker = "```";

    if (response.includes(gptStartSqlMarker)) {
        response = response.split(gptStartSqlMarker)[1];
    }

    if (response.includes(gptEndSqlMarker)) {
        response = response.split(gptEndSqlMarker)[0];
    }

    return response.trim();
}

async function main() {
    console.log("Starting the process...");
    const config = loadConfig();

    const apiKey = config.openaiKey;
    const organizationId = config.orgId;
    const model = config.model;

    const db = initDatabase();

    const commonSqlRequest = "Write me a sqlite select statement that answers the question. Only respond with sqlite syntax. If there is an error do not explain it.";

    const strategies = {
        zero_shot: loadSqlFile(setupSqlPath) + commonSqlRequest,
        single_domain_double_shot: loadSqlFile(setupSqlPath) +
            " Which customers have upcoming appointments? " +
            "\nSELECT c.customer_id, c.first_name, c.last_name\nFROM customer c\nJOIN appointment a ON c.customer_id = a.customer_id\nWHERE a.appointment_date > CURRENT_DATE;\n" +
            commonSqlRequest
    };

    const questions = [
        "Which customers have multiple appointments?",
        "Which stylists have served the most customers?",
        "Which service has been booked the most?",
        "Which customers have spent the most money on appointments?",
        "Which are the most expensive services offered?",
        "Who are the stylists hired most recently?",
        "What are the total earnings of each stylist based on completed appointments?",
        "Which customers have upcoming appointments?",
        "Who has been a customer the longest?"
    ];

    for (const [strategyName, promptPrefix] of Object.entries(strategies)) {
        const results = [];

        for (const question of questions) {
            try {
                console.log(`Processing question: ${question}`);
                let gptResponse = await getChatGptResponse(`${promptPrefix} ${question}`, model, 150, 0.7, apiKey, organizationId);
                let sqlSyntaxResponse = sanitizeSqlResponse(gptResponse);
                console.log(`Generated SQL: ${sqlSyntaxResponse}`);

                const queryRawResponse = await runSql(sqlSyntaxResponse, db);
                const queryRawResponseString = JSON.stringify(queryRawResponse, null, 2);
                console.log(`Query result: ${queryRawResponseString}`);

                const friendlyPrompt = `I asked the question '${question}' and the response was '${queryRawResponseString}'. Please, give a concise response in a more friendly way.`;
                const friendlyResponse = await getChatGptResponse(friendlyPrompt, model, 150, 0.7, apiKey, organizationId);
                console.log(`Friendly Response: ${friendlyResponse}`);

                results.push(`Question: ${question}`);
                results.push(`Generated SQL:\n${sqlSyntaxResponse}`);
                results.push(`Query Raw Result:\n${queryRawResponseString}`);
                results.push(`Friendly Response:\n${friendlyResponse}`);
                results.push(`\n-----------------------------\n`);

            } catch (error) {
                console.error(`Error: ${error.message}`);
                results.push(`Error processing question '${question}': ${error.message}`);
                results.push(`\n-----------------------------\n`);
            }
        }

        const resultFilePath = getPath(`response_${strategyName}_${Date.now()}.txt`);
        fs.writeFileSync(resultFilePath, results.join('\n'));
    }

    db.close();
}

main();

