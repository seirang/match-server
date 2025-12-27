import http.server
import socketserver
import json
import os
from urllib.parse import urlparse, parse_qs, quote
import requests
from dotenv import load_dotenv

# .env 파일에서 환경 변수 로드
load_dotenv()
api_key = os.getenv("RIOT_API_KEY")

# --- Riot API 호출 함수 ---
def get_user_info(riot_id, tag_line):
    if not api_key:
        return {"error": "RIOT_API_KEY가 .env 파일에 설정되지 않았습니다."}
    
    encoded_riot_id = quote(riot_id)
    encoded_tag_line = quote(tag_line)
    
    url_puuid = f"https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{encoded_riot_id}/{encoded_tag_line}?api_key={api_key}"

    try:
        response_puuid = requests.get(url_puuid, timeout=10)
        if response_puuid.status_code == 404: return {"error": "해당 유저는 존재하지 않습니다."}
        if response_puuid.status_code != 200: return {"error": f"PUUID 조회 오류: Status Code {response_puuid.status_code}"}
        
        puuid = response_puuid.json()['puuid']

        url_profile = f"https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}?api_key={api_key}"
        response_profile = requests.get(url_profile, timeout=10)
        if response_profile.status_code != 200: return {"error": f"프로필 정보 조회 오류: Status Code {response_profile.status_code}"}
        
        data_profile = response_profile.json()
        profile_icon_link = f"https://raw.communitydragon.org/latest/game/assets/ux/summonericons/profileicon{data_profile['profileIconId']}.png"

        url_league = f"https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}?api_key={api_key}"
        response_league = requests.get(url_league, timeout=10)
        if response_league.status_code != 200: return {"error": f"리그 정보 조회 오류: Status Code {response_league.status_code}"}

        data_league = response_league.json()

        user_info = {
            "riotId": f"{riot_id}#{tag_line}",
            "profileIconLink": profile_icon_link,
            "summonerLevel": data_profile['summonerLevel'],
            "league": "Unranked"
        }

        for entry in data_league:
            if entry['queueType'] == 'RANKED_SOLO_5x5':
                user_info["league"] = f"{entry['tier']} {entry['rank']} - {entry['leaguePoints']} LP"
                break
        
        return user_info
    
    except requests.exceptions.RequestException as e:
        return {"error": f"API 요청 실패: {e}"}

# --- 기본 HTTP 서버 ---
class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # API 요청 처리
        if parsed_path.path == '/api/get-user-info':
            params = parse_qs(parsed_path.query)
            riot_id = params.get('riot_id', [None])[0]
            tag_line = params.get('tag_line', [None])[0]
            
            if riot_id and tag_line:
                data = get_user_info(riot_id, tag_line)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            else:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Riot ID와 Tag Line을 입력해주세요."}).encode('utf-8'))
            return

        # 정적 파일 처리 (HTML, CSS, JS)
        if self.path == '/':
            self.path = 'index.html'
        
        # static 폴더 경로 처리
        if self.path.startswith('/static/'):
             # self.directory를 설정하여 SimpleHTTPRequestHandler가 파일을 찾도록 함
            super(MyHttpRequestHandler, self).do_GET()
        else:
            # 루트 디렉토리의 파일 처리
            super(MyHttpRequestHandler, self).do_GET()


PORT = int(os.getenv('PORT', 8000))
Handler = MyHttpRequestHandler

print(f"서버가 http://localhost:{PORT} 에서 실행 중입니다.")
print("웹 브라우저를 열고 위 주소로 접속하세요.")
print("서버를 종료하려면 Ctrl+C를 누르세요.")

try:
    with socketserver.TCPServer(('', PORT), Handler) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n서버를 종료합니다.")
    # with 구문이 끝나면서 httpd 리소스는 자동으로 정리됩니다.
except Exception as e:
    print(f"오류 발생: {e}")
