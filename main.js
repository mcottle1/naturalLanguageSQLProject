const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

function executeQuery(db, query) {
    return new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err.message);
            }
            resolve(rows);
        });
    });
}

async function main() {
    const dir = __dirname;
    const sqliteDbPath = path.join(dir, "database.sqlite");
    const tableInitPath = path.join(dir, "tableCreation.sql");
    const tableDataPath = path.join(dir, "tableData.sql");
    const configPath = path.join(dir, "config.json");

    if ( fs.existsSync(sqliteDbPath) ) {
        fs.unlinkSync(sqliteDbPath);
    }

    const db = new sqlite3.Database(sqliteDbPath);

    const tableInitScript = fs.readFileSync(tableInitPath, 'utf-8');
    const tableDataScript = fs.readFileSync(tableDataPath, 'utf-8');

    db.exec(tableInitScript, (err) => {
        if (err) throw err;
        db.exec(tableDataScript, (err) => {
            if (err) throw err;
        });
    });

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    const apiKey = config.openaiKey;
    const organizationId = config.orgId;
    const model = config.model;

    const commonSqlRequest = "Write me a sqlite select statement that answers the question. Only respond with sqlite syntax. If there is an error do not explain it.";

    const shots = {
        zero_shot: `${tableInitScript}${commonSqlRequest}`,
    
        double_shot: `${tableInitScript}
            -- Example Query 1: Which customers have upcoming appointments?
            SELECT c.customer_id, c.first_name, c.last_name
            FROM customer c
            JOIN appointment a ON c.customer_id = a.customer_id
            WHERE a.appointment_date > CURRENT_DATE;
    
            -- Example Query 2: What is the total number of appointments for each customer?
            SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.appointment_id) as total_appointments
            FROM customer c
            JOIN appointment a ON c.customer_id = a.customer_id
            GROUP BY c.customer_id, c.first_name, c.last_name;
    
            ${commonSqlRequest}`,
        
        multi_shot: `${tableInitScript}
            -- Example Query 1: Which customers have upcoming appointments?
            SELECT c.customer_id, c.first_name, c.last_name
            FROM customer c
            JOIN appointment a ON c.customer_id = a.customer_id
            WHERE a.appointment_date > CURRENT_DATE;
    
            -- Example Query 2: What is the total number of appointments for each customer?
            SELECT c.customer_id, c.first_name, c.last_name, COUNT(a.appointment_id) as total_appointments
            FROM customer c
            JOIN appointment a ON c.customer_id = a.customer_id
            GROUP BY c.customer_id, c.first_name, c.last_name;
    
            -- Example Query 3: Which customers have appointments next week?
            SELECT c.customer_id, c.first_name, c.last_name
            FROM customer c
            JOIN appointment a ON c.customer_id = a.customer_id
            WHERE a.appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
    
            ${commonSqlRequest}`
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


    for (const [strategyName, promptPrefix] of Object.entries(shots)) {
        const results = [];

        for (const question of questions) {
            try {
                console.log(`Processing question: ${question}`);
                let gptResponse = await getChatGptResponse(`${promptPrefix} ${question}`, model, 150, 0.7, apiKey, organizationId);
                console.log(`GPT Response: ${gptResponse}`);
                const regex = /```sql([\s\S]*?)```/g;
                const matches = gptResponse.match(regex);
                if (matches) {
                    gptResponse = matches[0].replace('```sql', '').replace('```', '').trim();
                }
                console.log(`Generated SQL: ${gptResponse}`);

                const result = await executeQuery(db, gptResponse);
                console.log('Query Result:', result);
                const resultString = JSON.stringify(result, null, 2);
                console.log('Query Result String:', resultString);

                const friendlyPrompt = `I asked the question '${question}' and the response was '${resultString}'. Please, give a concise response in a more friendly way.`;
                const friendlyResponse = await getChatGptResponse(friendlyPrompt, model, 150, 0.7, apiKey, organizationId);
                console.log(`Friendly Response: ${friendlyResponse}`);
                results.push(`Question: ${question}`);
                results.push(`Generated SQL:\n${gptResponse}`);
                results.push(`Query Raw Result:\n${resultString}`);
                results.push(`Friendly Response:\n${friendlyResponse}`);
                results.push(`\n-----------------------------\n`);

            } catch (error) {
                console.error(`Error: ${error.message}`);
                results.push(`Error processing question '${question}': ${error.message}`);
                results.push(`\n-----------------------------\n`);
            }
        }

        const resultFilePath = path.join(dir, `response_${strategyName}_${Date.now()}.txt`);
        fs.writeFileSync(resultFilePath, results.join('\n'));
    }
}

main();