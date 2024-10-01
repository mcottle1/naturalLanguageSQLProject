import openai
import json
import os

fdir = os.path.dirname(__file__)
def getPath(fname):
    return os.path.join(fdir, fname)

configPath = getPath("config.json")
print(configPath)
with open(configPath) as configFile:
    config = json.load(configFile)

openai.api_key = config["openaiKey"]

models = openai.Model.list()
print([model.id for model in models["data"]])
