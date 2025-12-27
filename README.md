# Team Maker 프로젝트

## 실행 방법

### 프론트엔드 실행 방법

1.  프로젝트 루트 디렉토리에서 다음 명령어를 실행하여 의존성을 설치합니다.
    ```bash
    npm install
    ```
2.  다음 명령어를 실행하여 프론트엔드 개발 서버를 시작합니다.
    ```bash
    npm start
    ```
    브라우저에서 `http://localhost:3000` 주소로 접속할 수 있습니다.

### 백엔드 실행 방법

1.  `backend` 디렉토리로 이동합니다.
    ```bash
    cd backend
    ```
2.  다음 명령어를 실행하여 의존성을 설치합니다.
    ```bash
    pip install -r requirements.txt
    ```
3.  `backend` 디렉토리 안에 `.env` 파일을 생성하고 다음과 같이 라이엇 API 키를 추가해야 합니다.
    ```
    RIOT_API_KEY='YOUR_RIOT_API_KEY'
    ```
    **참고:** `'YOUR_RIOT_API_KEY'` 부분을 실제 발급받은 라이엇 API 키로 교체해야 합니다. 이 키가 없으면 백엔드 서버가 정상적으로 동작하지 않습니다.

4.  다음 명령어를 실행하여 백엔드 서버를 시작합니다.
    ```bash
    python app.py
    ```
    서버는 `http://localhost:5000` 에서 실행됩니다.
