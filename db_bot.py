import json
import openai
import os
import sqlite3
from time import time

print("Running db_bot.py!")

fdir = os.path.dirname(__file__)
def getPath(fname):
    return os.path.join(fdir, fname)

sqliteDbPath = getPath("db.sqlite")
setupSqlPath = getPath("setup.sql")
setupSqlDataPath = getPath("setupData.sql")

if os.path.exists(sqliteDbPath):
    os.remove(sqliteDbPath) 

sqliteCon = sqlite3.connect(sqliteDbPath) 
sqliteCursor = sqliteCon.cursor()
with (
        open(setupSqlPath) as setupSqlFile,
        open(setupSqlDataPath) as setupSqlDataFile
    ):

    setupSqlScript = setupSqlFile.read()
    setupSQlDataScript = setupSqlDataFile.read()

sqliteCursor.executescript(setupSqlScript)
sqliteCursor.executescript(setupSQlDataScript)

def runSql(query):
    result = sqliteCursor.execute(query).fetchall()
    return result

configPath = getPath("config.json")
print(configPath)
with open(configPath) as configFile:
    config = json.load(configFile)

openai.api_key = config["openaiKey"]
openai.organization = config["orgId"]

def getChatGptResponse(content):
    stream = openai.ChatCompletion.create(
        model="gpt-4o-mini",  
        messages=[{"role": "user", "content": content}],
        stream=True  
    )

    responseList = []

    for chunk in stream:
        delta = chunk['choices'][0]['delta']
        if 'content' in delta:
            responseList.append(delta['content'])

    result = "".join(responseList)
    return result


commonSqlOnlyRequest = " Give me a sqlite select statement that answers the question. Only respond with sqlite syntax. If there is an error do not expalin it!"
strategies = {
    "zero_shot": setupSqlScript + commonSqlOnlyRequest,
    "single_domain_double_shot": (setupSqlScript + 
                   " Which customers have upcoming appointments? " + 
                   " \nSELECT c.customer_id, c.first_name, c.last_name\nFROM customer c\nJOIN appointment a ON c.customer_id = a.customer_id\nWHERE a.appointment_date > CURRENT_DATE;\n " +
                   commonSqlOnlyRequest)
}

questions = [
    "Which customers have multiple appointments?",
    "Which stylists have served the most customers?",
    "Which service has been booked the most?",
    "Which customers have spent the most money on appointments?",
    "Which are the most expensive services offered?",
    "Who are the stylists hired most recently?",
    "What are the total earnings of each stylist based on completed appointments?",
    "Which customers have upcoming appointments?",
    "Who has been a customer the longest?"
]

def sanitizeForJustSql(value):
    gptStartSqlMarker = "```sql"
    gptEndSqlMarker = "```"
    if gptStartSqlMarker in value:
        value = value.split(gptStartSqlMarker)[1]
    if gptEndSqlMarker in value:
        value = value.split(gptEndSqlMarker)[0]

    return value

for strategy in strategies:
    responses = {"strategy": strategy, "prompt_prefix": strategies[strategy]}
    questionResults = []
    for question in questions:
        print(question)
        error = "None"
        try:
            sqlSyntaxResponse = getChatGptResponse(strategies[strategy] + " " + question)
            sqlSyntaxResponse = sanitizeForJustSql(sqlSyntaxResponse)
            print(sqlSyntaxResponse)
            queryRawResponse = str(runSql(sqlSyntaxResponse))
            print(queryRawResponse)
            friendlyResultsPrompt = "I asked a question \"" + question +"\" and the response was \""+queryRawResponse+"\" Please, just give a concise response in a more friendly way? Please do not give any other suggests or chatter."
            friendlyResponse = getChatGptResponse(friendlyResultsPrompt)
            print(friendlyResponse)
        except Exception as err:
            error = str(err)
            print(err)

        questionResults.append({
            "question": question, 
            "sql": sqlSyntaxResponse, 
            "queryRawResponse": queryRawResponse,
            "friendlyResponse": friendlyResponse,
            "error": error
        })

    responses["questionResults"] = questionResults

    with open(getPath(f"response_{strategy}_{time()}.json"), "w") as outFile:
        json.dump(responses, outFile, indent = 2)
            

sqliteCursor.close()
sqliteCon.close()
print("Done!")