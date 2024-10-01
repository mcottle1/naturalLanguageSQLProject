import json
import openai
import os
import sqlite3
from time import time

fdir = os.path.dirname(__file__)

def get_path(fname):
    return os.path.join(fdir, fname)

sqlite_db_path = get_path("database.sqlite")
setup_sql_path = get_path("setup.sql")
setup_sql_data_path = get_path("setupData.sql")
config_path = get_path("config.json")

def load_sql_file(file_path):
    with open(file_path) as file:
        return file.read()

def init_database():
    if os.path.exists(sqlite_db_path):
        os.remove(sqlite_db_path)

    with sqlite3.connect(sqlite_db_path) as con:
        cursor = con.cursor()
        setup_sql_script = load_sql_file(setup_sql_path)
        setup_sql_data_script = load_sql_file(setup_sql_data_path)

        cursor.executescript(setup_sql_script)
        cursor.executescript(setup_sql_data_script)

    return sqlite3.connect(sqlite_db_path)

def run_sql(query, cursor):
    return cursor.execute(query).fetchall()

def load_config():
    with open(config_path) as config_file:
        return json.load(config_file)

def get_chat_gpt_response(prompt, model="gpt-4", max_tokens=150, temperature=0.7):
    try:
        response = openai.ChatCompletion.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature
        )
        return response['choices'][0]['message']['content'].strip()
    except Exception as e:
        return f"Error: {str(e)}"

def sanitize_sql_response(response):
    gpt_start_sql_marker = "```sql"
    gpt_end_sql_marker = "```"

    if gpt_start_sql_marker in response:
        response = response.partition(gpt_start_sql_marker)[2]
    
    if gpt_end_sql_marker in response:
        response = response.partition(gpt_end_sql_marker)[0]
    
    return response.strip()

def main():
    config = load_config()
    openai.api_key = config["openaiKey"]
    openai.organization = config["orgId"]
    model = config["model"]  
    
    sqlite_con = init_database()
    cursor = sqlite_con.cursor()

    common_sql_request = "Write me a sqlite select statement that answers the question. Only respond with sqlite syntax. If there is an error do not explain it."
    
    strategies = {
        "zero_shot": load_sql_file(setup_sql_path) + common_sql_request,
        "single_domain_double_shot": (load_sql_file(setup_sql_path) +
            " Which customers have upcoming appointments? " + 
            " \nSELECT c.customer_id, c.first_name, c.last_name\nFROM customer c\nJOIN appointment a ON c.customer_id = a.customer_id\nWHERE a.appointment_date > CURRENT_DATE;\n " +
            common_sql_request)
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

    for strategy, prompt_prefix in strategies.items():
        responses = {"strategy": strategy, "prompt_prefix": prompt_prefix}
        question_results = []
        
        for question in questions:
            print(f"Processing question: {question}")
            try:
                gpt_response = get_chat_gpt_response(prompt_prefix + " " + question, model=model)
                sql_syntax_response = sanitize_sql_response(gpt_response)
                print(f"Generated SQL: {sql_syntax_response}")
                
                query_raw_response = str(run_sql(sql_syntax_response, cursor))
                print(f"Query result: {query_raw_response}")
                
                friendly_prompt = (f"I asked the question '{question}' and the response was '{query_raw_response}'. "
                                   "Please, give a concise response in a more friendly way.")
                
                friendly_response = get_chat_gpt_response(friendly_prompt, model=model)
                print(f"Friendly Response: {friendly_response}")
            except Exception as err:
                print(f"Error: {err}")
                question_results.append({
                    "question": question,
                    "sql": sql_syntax_response,
                    "queryRawResponse": "",
                    "friendlyResponse": "",
                    "error": str(err)
                })
                continue

            question_results.append({
                "question": question,
                "sql": sql_syntax_response,
                "queryRawResponse": query_raw_response,
                "friendlyResponse": friendly_response,
                "error": "None"
            })

        responses["questionResults"] = question_results
        
        with open(get_path(f"response_{strategy}_{int(time())}.json"), "w") as outfile:
            json.dump(responses, outfile, indent=2)

    cursor.close()

if __name__ == "__main__":
    main()
