import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import PlayerCard from './PlayerCard';
import './App.css';

const API_URL = 'http://localhost:5001/api';
const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

// Helper to calculate a numeric score based on tier for sorting
const getTierScore = (player) => {
    if (!player.tier || player.tier === 'UNRANKED') return 0;
    const tierValues = { 'IRON': 0, 'BRONZE': 1000, 'SILVER': 2000, 'GOLD': 3000, 'PLATINUM': 4000, 'EMERALD': 5000, 'DIAMOND': 6000, 'MASTER': 7000, 'GRANDMASTER': 8000, 'CHALLENGER': 9000 };
    const rankValues = { 'IV': 0, 'III': 100, 'II': 200, 'I': 300 };
    return (tierValues[player.tier.toUpperCase()] || 0) + (rankValues[player.rank] || 0) + (player.leaguePoints || 0);
};

function App() {
  const [riotIdInput, setRiotIdInput] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [matchQueue, setMatchQueue] = useState([]);
  
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [showTeams, setShowTeams] = useState(false);

  const [message, setMessage] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [balanceMode, setBalanceMode] = useState('role'); // 'role' or 'tier'

  // --- Data Fetching and State Initialization ---
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response = await axios.get(`${API_URL}/favorites`);
        setFavorites(response.data);
      } catch (error) {
        console.error("Failed to fetch favorites:", error);
        showMessage('즐겨찾기 목록을 불러오는 데 실패했습니다.', 'error');
      }
    };
    fetchFavorites();
  }, []);

  // --- Message Handling ---
  const showMessage = (text, type = 'info', duration = 4000) => {
    setMessage({ text, type });
    if (type !== 'error') {
      setTimeout(() => setMessage({ text: '', type: '' }), duration);
    }
  };

  // --- Match Queue Management ---
  const addPlayerToQueue = (player) => {
    setMatchQueue(currentQueue => {
        if (currentQueue.length >= 10) {
            showMessage('매치 큐가 가득 찼습니다 (10명).', 'error');
            return currentQueue;
        }
        if (currentQueue.some(p => p.puuid === player.puuid)) {
            showMessage(`${player.summonerName || player.gameName}님은 이미 큐에 있습니다.`, 'error');
            return currentQueue;
        }
        const playerWithRoles = { ...player, primaryRole: null, secondaryRole: null };
        return [...currentQueue, playerWithRoles];
    });
  };

  const handleRoleChange = (puuid, roleType, value) => {
    setMatchQueue(currentQueue => currentQueue.map(p => {
      if (p.puuid === puuid) {
        const otherRoleType = roleType === 'primaryRole' ? 'secondaryRole' : 'primaryRole';
        if (value && value === p[otherRoleType]) {
          return { ...p, [roleType]: value, [otherRoleType]: p[roleType] };
        }
        return { ...p, [roleType]: value || null };
      }
      return p;
    }));
  };

  // --- Player Search and Add to Queue ---
  const handleSearchAndAdd = async (e) => {
    e.preventDefault();
    if (!riotIdInput) return;
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    const ids = riotIdInput.split('\n').map(id => id.trim()).filter(id => id);
    if (ids.length === 0) {
        setIsLoading(false);
        return;
    }
    if (matchQueue.length + ids.length > 10) {
        showMessage(`큐에 자리가 부족합니다. (현재 ${matchQueue.length}명, ${10 - matchQueue.length}명 추가 가능)`, 'error');
        setIsLoading(false);
        return;
    }
    let successCount = 0;
    let errorMessages = [];
    for (const id of ids) {
        try {
            const response = await axios.post(`${API_URL}/fetch-player`, { riotId: id });
            addPlayerToQueue(response.data);
            successCount++;
        } catch (error) {
            console.error(`Search error for ${id}:`, error);
            const errorMsg = error.response?.data?.error || '알 수 없는 오류';
            errorMessages.push(`${id}: ${errorMsg}`);
        }
    }
    if (errorMessages.length > 0) {
        showMessage(errorMessages.join(' / '), 'error');
    } else {
        showMessage(`${successCount}명의 플레이어를 성공적으로 추가했습니다.`);
    }
    setRiotIdInput('');
    setIsLoading(false);
  };

  // --- Favorites Management (API) ---
  const handleFavoriteToggle = async (player) => {
    const isFavorited = favorites.some(fav => fav.puuid === player.puuid);
    try {
      if (isFavorited) {
        await axios.delete(`${API_URL}/favorites/${player.puuid}`);
        setFavorites(prev => prev.filter(fav => fav.puuid !== player.puuid));
      } else {
        const response = await axios.post(`${API_URL}/favorites`, player);
        setFavorites(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error("Favorite toggle error:", error);
      showMessage('즐겨찾기 작업 중 오류가 발생했습니다.', 'error');
    }
  };

  const removePlayerFromQueue = (puuid) => {
    setMatchQueue(prev => prev.filter(p => p.puuid !== puuid));
    if (showTeams) setShowTeams(false);
  };

  const handleClearQueue = () => {
    setMatchQueue([]);
    setShowTeams(false);
  };

  // --- Team Generation ---
  const generateTeams = useCallback(() => {
    if (matchQueue.length !== 10) return;

    if (balanceMode === 'tier') {
      // Original snake draft logic based on tier
      const sortedPlayers = [...matchQueue].sort((a, b) => getTierScore(b) - getTierScore(a));
      const newTeam1 = [];
      const newTeam2 = [];
      const distributionPattern = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
      sortedPlayers.forEach((player, index) => {
          if (distributionPattern[index] === 0) newTeam1.push(player);
          else newTeam2.push(player);
      });
      setTeam1(newTeam1);
      setTeam2(newTeam2);
    } else {
      // New role-based logic
      let team1 = [];
      let team2 = [];
      let availablePlayers = [...matchQueue].sort((a, b) => getTierScore(b) - getTierScore(a));

      const findAndAssign = (role, team) => {
        let playerToAssign = null;
        let playerIndex = -1;

        // 1. Find by Primary Role
        playerIndex = availablePlayers.findIndex(p => p.primaryRole === role);
        if (playerIndex !== -1) {
          playerToAssign = availablePlayers[playerIndex];
        } else {
          // 2. Find by Secondary Role
          playerIndex = availablePlayers.findIndex(p => p.secondaryRole === role);
          if (playerIndex !== -1) {
            playerToAssign = availablePlayers[playerIndex];
          }
        }
        
        if (playerToAssign) {
          team.push({ ...playerToAssign, assignedRole: role });
          availablePlayers.splice(playerIndex, 1);
          return true;
        }
        return false;
      };

      // Assign one player for each role to each team
      ROLES.forEach(role => {
        findAndAssign(role, team1);
        findAndAssign(role, team2);
      });

      // Assign remaining players (fillers)
      availablePlayers.forEach(player => {
        if (team1.length < 5) {
          team1.push(player);
        } else {
          team2.push(player);
        }
      });
      
      setTeam1(team1);
      setTeam2(team2);
    }
    setShowTeams(true);
  }, [matchQueue, balanceMode]);

  const isPlayerInFavorites = (puuid) => favorites.some(fav => fav.puuid === puuid);

  return (
    <div className="container">
      <header>
        <h1>5v5 팀 생성기</h1>
        <p>플레이어를 큐에 추가하고, 밸런스 모드를 선택한 후 팀을 생성하세요.</p>
      </header>

      <div className="mode-selector">
        <button className={balanceMode === 'role' ? 'active' : ''} onClick={() => setBalanceMode('role')}> 
          포지션 우선
        </button>
        <button className={balanceMode === 'tier' ? 'active' : ''} onClick={() => setBalanceMode('tier')}> 
          티어 우선
        </button>
      </div>

      <div className="app-layout">
        <main className="main-content">
          <div className="form-container">
            <form id="add-player-form" onSubmit={handleSearchAndAdd}>
              <div className="input-group">
                <textarea
                  value={riotIdInput}
                  onChange={(e) => setRiotIdInput(e.target.value)}
                  placeholder="Riot ID#Tag (한 줄에 한 명씩 입력)"
                  required
                  disabled={matchQueue.length >= 10}
                />
              </div>
              <button type="submit" id="add-btn" disabled={isLoading || matchQueue.length >= 10}>
                {isLoading ? '추가 중...' : '플레이어 추가'}
              </button>
            </form>
            <div className={`message ${message.type}`}>{message.text}</div>
          </div>

          <div className="queue-container">
            <div className="queue-header">
              <h2>매치 대기열 ({matchQueue.length}/10)</h2>
              <div>
                {matchQueue.length === 10 && !showTeams && (
                  <button id="generate-teams-btn" onClick={generateTeams}>팀 생성</button>
                )}
                {matchQueue.length > 0 && (
                  <button className="subtle-btn" onClick={handleClearQueue}>전체 삭제</button>
                )}
              </div>
            </div>
            <div className="player-grid">
              {matchQueue.map(p => (
                <PlayerCard 
                  key={p.puuid} 
                  player={p} 
                  onDelete={() => removePlayerFromQueue(p.puuid)}
                  isFavorite={isPlayerInFavorites(p.puuid)}
                  onFavoriteToggle={() => handleFavoriteToggle(p)}
                  roles={ROLES}
                  onRoleChange={handleRoleChange}
                  showRoles={balanceMode === 'role'}
                />
              ))}
            </div>
          </div>

          {showTeams && (
            <div id="result-container">
              <h2>팀 구성 결과</h2>
              <div className="teams">
                <div className="team">
                  <h3>TEAM 1</h3>
                  {team1.map(p => <PlayerCard key={p.puuid} player={p} assignedRole={p.assignedRole} />)}
                </div>
                <div className="team">
                  <h3>TEAM 2</h3>
                  {team2.map(p => <PlayerCard key={p.puuid} player={p} assignedRole={p.assignedRole} />)}
                </div>
              </div>
              <button id="reset-btn" onClick={handleClearQueue}>다시 시작</button>
            </div>
          )}
        </main>

        <aside className="favorites-sidebar">
          <h2>즐겨찾기</h2>
          <div className="favorites-list">
            {favorites.length > 0 ? (
              favorites.map(fav => (
                <PlayerCard 
                  key={fav.puuid} 
                  player={fav}
                  isFavorite={true}
                  onFavoriteToggle={() => handleFavoriteToggle(fav)}
                  onClick={() => addPlayerToQueue(fav)}
                />
              ))
            ) : (
              <p>즐겨찾기한 플레이어가 없습니다.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;