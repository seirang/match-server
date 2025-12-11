import os
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pathlib import Path

# --- App Setup ---
# Explicitly load .env from the same directory as app.py
dotenv_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=dotenv_path)

app = Flask(__name__)
CORS(app) # Allow frontend to call backend

# --- Riot API Configuration & Helpers ---
RIOT_API_KEY = os.getenv('RIOT_API_KEY')
API_HEADERS = {'X-Riot-Token': RIOT_API_KEY}

def get_latest_ddragon_version():
    """Fetches the latest version of Data Dragon."""
    try:
        versions_url = "https://ddragon.leagueoflegends.com/api/versions.json"
        versions_res = requests.get(versions_url)
        versions_res.raise_for_status()
        return versions_res.json()[0]
    except Exception:
        return "14.9.1" # Fallback if fetching fails

DDRAGON_VERSION = get_latest_ddragon_version()


# --- API Endpoints ---

@app.route('/api/fetch-player', methods=['POST', 'OPTIONS'])
def fetch_player():
    """Fetch user from Riot API. Does not interact with a database."""
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    riot_id = request.json.get('riotId')
    if not riot_id or '#' not in riot_id:
        return jsonify({'error': 'Invalid Riot ID format. Expected "gameName#tagLine".'}), 400

    game_name, tag_line = riot_id.split('#', 1)

    try:
        # 1. Get Account data (PUUID, canonical Riot ID)
        account_url = f"https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
        account_res = requests.get(account_url, headers=API_HEADERS)
        account_res.raise_for_status()
        account_data = account_res.json()
        puuid = account_data['puuid']

        # 2. Get Summoner data (for name, level, icon)
        summoner_url = f"https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
        summoner_res = requests.get(summoner_url, headers=API_HEADERS)
        summoner_res.raise_for_status()
        summoner_data = summoner_res.json()

        # 3. Get League data using PUUID
        league_url = f"https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
        league_res = requests.get(league_url, headers=API_HEADERS)
        league_res.raise_for_status()
        solo_queue = next((q for q in league_res.json() if q['queueType'] == 'RANKED_SOLO_5x5'), None)

        # 4. Construct player data
        player_data = {
            'puuid': puuid,
            'gameName': account_data.get('gameName', game_name),
            'tagLine': account_data.get('tagLine', tag_line),
            'summonerName': summoner_data.get('name', account_data.get('gameName')),
            'profileIconId': summoner_data.get('profileIconId', 0),
            'summonerLevel': summoner_data.get('summonerLevel', 1),
            'tier': solo_queue['tier'] if solo_queue else 'UNRANKED',
            'rank': solo_queue['rank'] if solo_queue else '',
            'leaguePoints': solo_queue['leaguePoints'] if solo_queue else 0,
            'wins': solo_queue['wins'] if solo_queue else 0,
            'losses': solo_queue['losses'] if solo_queue else 0,
        }
        
        player_data['profileIconUrl'] = f"https://ddragon.leagueoflegends.com/cdn/{DDRAGON_VERSION}/img/profileicon/{player_data['profileIconId']}.png"
        
        return jsonify(player_data), 200

    except requests.exceptions.HTTPError as err:
        status_code = err.response.status_code
        if status_code == 404:
            return jsonify({'error': 'Player not found.'}), 404
        return jsonify({'error': 'Failed to fetch data from Riot API.', 'details': err.response.text}), status_code
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({'error': 'An internal server error occurred.', 'details': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5001)