import requests
import sys
import json
import time

# easy error printing
def printError(errDict, info):
    print(info, f"in dict {errDict}\n")
    return None

def getNewDict(originalDict):

    newDict = {}

    for key, value in originalDict.items():
        newDict[key] = value

    levelID = originalDict.get("level_id")
    if levelID is None:
        return printError(originalDict, "No level id field")

    # changing the tower level ids to robsvault ids
    if levelID == 5001:
        levelID = 97459496
    elif levelID == 5002:
        levelID = 97459505
    elif levelID == 5003:
        levelID = 97459509
    elif levelID == 5004:
        levelID = 97459514

    headers = {"User-Agent": ""}
    data = {"secret": "Wmfd2893gb7", "type": 0, "str": str(levelID)}
    url = "http://www.boomlings.com/database/getGJLevels21.php"

    request = ""

    try:
        request = requests.post(url=url, data=data, headers=headers)
        request.raise_for_status()
    except requests.exceptions.RequestException as e:
        if e.response is not None and e.response.status_code == 429:
            waitTime = int(e.response.headers.get("Retry-After", 60))
            print(f"Rate limited :( gotta wait for {waitTime} seconds")
            time.sleep(waitTime+0.5)
            return getNewDict(originalDict)
        return printError(originalDict, f"Connection to GD server failed with {e}")

    if request.text == "-1":
        return printError(originalDict, f"Invalid level id")

    levelString = request.text.split("#")[0]
    levelArray = levelString.split(":")
    
    levelDict = {}
    isKey = True
    curKey = ""
    for token in levelArray:
        if isKey:
            curKey = token
        else:
            curValue = token
            levelDict[curKey] = curValue
        isKey = not isKey

    newDict["level_name"] = levelDict.get("2")
    newDict["moons"] = levelDict.get("18")

    match levelDict:
        case {"9": "0"}:
            newDict["difficulty"] = "Unrated"
        case {"9": "10", "17": "1"}:
            newDict["difficulty"] = "Easy Demon"
        case {"9": "20", "17": "1"}:
            newDict["difficulty"] = "Medium Demon"
        case {"9": "30", "17": "1"}:
            newDict["difficulty"] = "Hard Demon"
        case {"9": "40", "17": "1"}:
            newDict["difficulty"] = "Insane Demon"
        case {"9": "50", "17": "1"}:
            newDict["difficulty"] = "Extreme Demon"
        case {"9": "10"}:
            newDict["difficulty"] = "Easy"
        case {"9": "20"}:
            newDict["difficulty"] = "Normal"
        case {"9": "30"}:
            newDict["difficulty"] = "Hard"
        case {"9": "40"}:
            newDict["difficulty"] = "Harder"
        case {"9": "50"}:
            newDict["difficulty"] = "Insane"

    return newDict

def main(inpJson="runs.json", outJson="filled_runs.json"):

    if inpJson == outJson:
        print("Your input and output jsons are the same, running this will overwrite the old json file.")
        print("Type capital Y to confirm you want to do this, anything else to quit")
        if input() != "Y":
            return 0

    loadedInpJson = ""
    with open(inpJson, 'r', encoding="utf-8") as file:
        loadedInpJson = json.load(file)

    dictArray = []
    try:
        with open(outJson, 'r', encoding="utf-8") as file:
            dictArray = json.load(file)
    except:
        print("Output file doesn't exist, it will be created at the end of execution")

    for originalDict in loadedInpJson:
        # first we check if its already been loaded
        alreadyLoaded = False
        for outDict in dictArray:
            sameID = originalDict.get("level_id") == outDict.get("level_id")
            sameDate = originalDict.get("date") == outDict.get("date")
            sameTicks = originalDict.get("ticks") == outDict.get("ticks")

            if sameID and sameDate and sameTicks:
                alreadyLoaded = True
                break
            
        if alreadyLoaded:
            continue
                
        time.sleep(1)
        newDict = getNewDict(originalDict)
        if newDict is not None:
            dictArray.append(newDict)

    with open(outJson, 'w', encoding="utf-8") as file:
        json.dump(dictArray, file, indent=2)

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        main(sys.argv[1], sys.argv[2])
    else:
        main()