import React from 'react';

const PlayerCard = ({ player, onDelete, onFavoriteToggle, isFavorite, onClick, roles, onRoleChange, showRoles, assignedRole }) => {
  const tierClass = player.tier ? `tier-${player.tier.toLowerCase()}` : 'tier-unranked';

  const handleFavoriteClick = (e) => {
    e.stopPropagation(); // Prevent card's onClick from firing
    onFavoriteToggle(player);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation(); // Prevent card's onClick from firing
    onDelete(player.puuid);
  };

  const handleRoleChange = (e, roleType) => {
    e.stopPropagation();
    onRoleChange(player.puuid, roleType, e.target.value);
  };

  return (
    <div className={`player-card ${tierClass} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {onDelete && (
        <button className="delete-player-btn" onClick={handleDeleteClick}>×</button>
      )}
      
      {onFavoriteToggle && (
        <button 
          className={`favorite-btn ${isFavorite ? 'favorited' : ''}`} 
          onClick={handleFavoriteClick}
        >
          ★
        </button>
      )}

      <img src={player.profileIconUrl} alt={`${player.summonerName || player.gameName} icon`} className="player-icon" />
      <div className="player-info">
        <div className="player-name">{player.summonerName || `${player.gameName}#${player.tagLine}`}</div>
        <div className="player-tier">
          {player.tier === 'UNRANKED' ? 'Unranked' : `${player.tier} ${player.rank} - ${player.leaguePoints} LP`}
        </div>
        {assignedRole && <div className="player-assigned-role">{assignedRole}</div>}
        {showRoles && onRoleChange && roles && (
          <div className="player-roles">
            <select value={player.primaryRole || ''} onChange={(e) => handleRoleChange(e, 'primaryRole')} onClick={(e) => e.stopPropagation()}>
              <option value="">주 라인</option>
              {roles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
            <select value={player.secondaryRole || ''} onChange={(e) => handleRoleChange(e, 'secondaryRole')} onClick={(e) => e.stopPropagation()}>
              <option value="">부 라인</option>
              {roles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;