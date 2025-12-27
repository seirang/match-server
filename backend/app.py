import os
import requests
import sqlite3
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

# --- Database Setup ---
DB_PATH = Path(__file__).parent / 'database.db'

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database and creates the favorites table if it doesn't exist."""
    with get_db_connection() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS favorites (
                puuid TEXT PRIMARY KEY,
                gameName TEXT NOT NULL,
                tagLine TEXT NOT NULL,
                summonerName TEXT,
                profileIconId INTEGER,
                summonerLevel INTEGER,
                tier TEXT,
                rank TEXT,
                leaguePoints INTEGER,
                wins INTEGER,
                losses INTEGER,
                profileIconUrl TEXT
            )
        ''')
        conn.commit()

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

# --- Favorites Endpoints ---

@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    """Retrieve all favorited players from the database."""
    with get_db_connection() as conn:
        favorites = conn.execute('SELECT * FROM favorites').fetchall()
        return jsonify([dict(row) for row in favorites])

@app.route('/api/favorites', methods=['POST'])
def add_favorite():
    """Add a player to the favorites list in the database."""
    player_data = request.json
    required_fields = ['puuid', 'gameName', 'tagLine', 'profileIconUrl']
    if not all(field in player_data for field in required_fields):
        return jsonify({'error': 'Missing required player data.'}), 400

    with get_db_connection() as conn:
        try:
            conn.execute(
                '''
                INSERT INTO favorites (puuid, gameName, tagLine, summonerName, profileIconId, summonerLevel, tier, rank, leaguePoints, wins, losses, profileIconUrl)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    player_data.get('puuid'),
                    player_data.get('gameName'),
                    player_data.get('tagLine'),
                    player_data.get('summonerName'),
                    player_data.get('profileIconId'),
                    player_data.get('summonerLevel'),
                    player_data.get('tier'),
                    player_data.get('rank'),
                    player_data.get('leaguePoints'),
                    player_data.get('wins'),
                    player_data.get('losses'),
                    player_data.get('profileIconUrl')
                )
            )
            conn.commit()
            return jsonify(player_data), 201
        except sqlite3.IntegrityError:
            return jsonify({'error': 'Player already in favorites.'}), 409
        except Exception as e:
            print(f"Error adding favorite: {e}")
            return jsonify({'error': 'An internal server error occurred while adding favorite.'}), 500

@app.route('/api/favorites/<string:puuid>', methods=['DELETE'])
def delete_favorite(puuid):
    """Delete a player from favorites by their PUUID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM favorites WHERE puuid = ?', (puuid,))
        conn.commit()
        if cursor.rowcount > 0:
            return jsonify({'message': 'Favorite deleted successfully.'}), 200
        else:
            return jsonify({'error': 'Favorite not found.'}), 404


if __name__ == '__main__':
    init_db() # Initialize database on startup
    app.run(debug=True, port=5001)